import requests
import json

# Supabase Credentials (from .env)
SUPABASE_URL = "https://phjrzomytttepqgueqcv.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoanJ6b215dHR0ZXBxZ3VlcWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTU5NzgsImV4cCI6MjA4NzEzMTk3OH0.YbnWMfzP3eS-_P63AwJgZ6sbUcZ6eym3pVFwq5gUiSQ"

def create_admin(email, password, full_name):
    url = f"{SUPABASE_URL}/rest/v1/users"
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    payload = {
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": "admin"
    }
    
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    
    if response.status_code == 201:
        print(f"✅ Admin created successfully: {email}")
    else:
        print(f"❌ Failed to create admin: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    print("--- SmartResolve AI Admin Creator ---")
    email = input("Enter Admin Email: ")
    password = input("Enter Admin Password: ")
    name = input("Enter Full Name: ")
    
    create_admin(email, password, name)
