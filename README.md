# Campus Dual Cal Web Applet

A local web application designed to synchronize your university schedule from the Campus Dual legacy portal to your Google Calendar.

## ⚠️ Important Note
This application runs **locally** on your computer. All configuration and synchronization data are stored strictly on your local filesystem and are never transmitted to any external servers other than those required for the official Google Calendar API integration.

## Project Selection
Instead of the provided small exercises, I have chosen to complete **one large exercise (Große Aufgabe)** as part of the academic requirements.

* **Selected Task:** Development of a custom synchronization web applet.  
* **Motivation:** The goal was to provide an interface to extract the university schedule from the Campus Dual legacy portal and make it available on modern mobile devices by leveraging Google Calendar as an intermediary synchronization platform.

---

## Setup Instructions

### 1. Prerequisites
* Node.js installed on your machine.  
* Python installed on your machine.

### 2. Installation & Execution
1. Clone this repository to your local machine.  
2. Navigate to the project folder in your terminal.  
3. Install the necessary dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

Nach dem Starten des Befehls **npm start** ist die Webanwendung lokal über Ihren Browser unter der Adresse **http://localhost:3000** erreichbar.

---

## Google Calendar Upload Requirements

If you want to use the optional **Google Calendar upload/synchronization** feature, two additional configuration steps are required:

### 1. Add Your Google Calendar ID  
Inside your `config.json`, you must include the **Google Calendar ID** of the sub‑calendar you want the app to write to.  
The recommended calendar name is **“Uni Cal”**, but any calendar works as long as its ID is correctly added.

Example:

```json
{
  "studentId": "1234567",
  "apiHash": "your-campus-dual-api-hash",
  "googleCalendarId": "your-uni-cal-id@group.calendar.google.com"
}
```

### 2. Provide Google OAuth Credentials  
Download your Google OAuth `credentials.json` from the Google Cloud Console and place it **directly in the project’s main folder** (same directory as `config.json`).

This file is required for the app to authenticate with your Google account and gain permission to upload events.

---

## Additional Information
**Configuration:** Please ensure the `config.json` file is correctly populated with your student ID, API hash, and—if using Google Calendar upload—the Google Calendar ID.  
**Support:** If you encounter any issues during the startup or usage of this web project, please feel free to contact me at: **s3006111@edu.dhsn.de**
```