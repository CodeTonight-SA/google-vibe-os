import os
import datetime
from flask import Flask, jsonify, redirect, request
from flask_cors import CORS
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configuration
CREDENTIALS_FILE = '.agent/secrets/credentials.json'
TOKEN_FILE = '.agent/secrets/token_dashboard.json' # Separate token file for dashboard specific scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.profile'
]

class GoogleService:
    def __init__(self):
        self.creds = None
        self.authenticate()

    def authenticate(self):
        if os.path.exists(TOKEN_FILE):
            try:
                self.creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
            except Exception as e:
                print(f"Error loading token: {e}")

        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    self.creds.refresh(Request())
                except Exception:
                    self.creds = None

            if not self.creds:
                # If running headless, we might need a different flow, but for local "OS" dashboard:
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
                self.creds = flow.run_local_server(port=0, open_browser=False)
            
            with open(TOKEN_FILE, 'w') as token:
                token.write(self.creds.to_json())

    def get_gmail_service(self):
        return build('gmail', 'v1', credentials=self.creds)

    def get_calendar_service(self):
        return build('calendar', 'v3', credentials=self.creds)

    def get_drive_service(self):
        return build('drive', 'v3', credentials=self.creds)
        
    def get_people_service(self):
         return build('oauth2', 'v2', credentials=self.creds)

google_service = GoogleService()

@app.route('/api/profile')
def profile():
    try:
        service = google_service.get_people_service()
        user_info = service.userinfo().get().execute()
        return jsonify(user_info)
    except Exception as e:
         return jsonify({"error": str(e)}), 500

@app.route('/api/gmail')
def gmail():
    try:
        service = google_service.get_gmail_service()
        results = service.users().messages().list(userId='me', maxResults=10, labelIds=['INBOX']).execute()
        messages = results.get('messages', [])
        
        email_list = []
        if messages:
            # Batch get details for efficiency could be better, but doing simple loop for now
            for message in messages:
                msg = service.users().messages().get(userId='me', id=message['id'], format='metadata').execute()
                headers = msg['payload']['headers']
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
                
                email_list.append({
                    "id": message['id'],
                    "subject": subject,
                    "from": sender,
                    "date": date,
                    "snippet": msg.get('snippet', '')
                })
        return jsonify(email_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/calendar')
def calendar():
    try:
        service = google_service.get_calendar_service()
        now = datetime.datetime.utcnow().isoformat() + 'Z'  # 'Z' indicates UTC time
        
        events_result = service.events().list(
            calendarId='primary', timeMin=now,
            maxResults=10, singleEvents=True,
            orderBy='startTime'
        ).execute()
        events = events_result.get('items', [])
        
        event_list = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            event_list.append({
                "id": event['id'],
                "summary": event.get('summary', 'No Title'),
                "start": start,
                "htmlLink": event.get('htmlLink')
            })
            
        return jsonify(event_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/drive')
def drive():
    try:
        service = google_service.get_drive_service()
        # Query for non-trashed files, ordered by modified time desc
        results = service.files().list(
            pageSize=12,
            q="trashed = false",
            orderBy="modifiedTime desc",
            fields="nextPageToken, files(id, name, mimeType, iconLink, webViewLink, thumbnailLink)"
        ).execute()
        items = results.get('files', [])
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Google OS Backend on port 5000...")
    app.run(port=5000, debug=True)
