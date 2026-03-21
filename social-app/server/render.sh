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
if email and username and password and not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser(email=email, username=username, password=password)
    print("Superuser created!")
else:
    print("Skipped superuser creation.")
EOF
