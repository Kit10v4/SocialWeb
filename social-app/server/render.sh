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
    user, created = User.objects.get_or_create(
        email=email,
        defaults={'username': username}
    )
    user.set_password(password)
    user.is_superuser = True
    user.is_staff = True
    user.save()
    print(f"Admin {'created' if created else 'updated'}: {email}")
else:
    print("Skipped - missing env vars")
EOF
