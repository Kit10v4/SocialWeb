#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput

python manage.py shell << 'EOF'
import os
from apps.users.models import User

email = os.environ.get('ADMIN_EMAIL', '')
username = os.environ.get('ADMIN_USERNAME', '')
password = os.environ.get('ADMIN_PASSWORD', '')

if email and username and password:
    # Try to get user by email first
    user = User.objects.filter(email=email).first()

    if user:
        # User exists, update password and permissions
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.save()
        print(f"Admin updated: {email}")
    else:
        # Check if username exists
        if User.objects.filter(username=username).exists():
            username = f"{username}_{email.split('@')[0]}"

        # Create new user
        user = User.objects.create_superuser(
            email=email,
            username=username,
            password=password
        )
        print(f"Admin created: {email} (username: {username})")
else:
    print("Skipped - missing env vars")
EOF
