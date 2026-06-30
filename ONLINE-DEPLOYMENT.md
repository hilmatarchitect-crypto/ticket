# Bookings Time Online Deployment

This app is now prepared for online use with:

- Staff/admin login
- Online PostgreSQL database support
- Server-side Gemini API key
- HTML and PDF itinerary generation
- Automatic cleanup after 7 days

## Accounts You Need

1. Render account for the free web app link and database.
2. GitHub account so Render can deploy this project.

## Online Database

The Render Blueprint now creates a free PostgreSQL database automatically.
The app creates its own tables the first time it starts.

## Render Deployment

1. Put this project in a GitHub repository.
2. Open Render.
3. Click New.
4. Choose Blueprint.
5. Select the GitHub repository.
6. Render will read `render.yaml`.
7. Paste the environment variables below.
8. Click Deploy.

## Environment Variables To Paste In Render

Use these names exactly:

```text
GEMINI_API_KEY=your Gemini API key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose a strong admin password
STAFF_USERNAME=staff
STAFF_PASSWORD=choose a staff password
GEMINI_MODEL=gemini-2.5-flash
AUTO_DELETE_DAYS=7
NODE_ENV=production
```

Do not put the Gemini API key in the app page. Only paste it in Render environment variables during deployment.

## Login

Admin login:

- Username: the value of `ADMIN_USERNAME`
- Password: the value of `ADMIN_PASSWORD`

Staff login:

- Username: the value of `STAFF_USERNAME`
- Password: the value of `STAFF_PASSWORD`

Admin can delete generated records and clean old records now.
Staff can upload, review, generate, open, and download itineraries.

## What Link To Share

After Render finishes deploying, it gives you a free link like:

```text
https://bookings-time-itinerary.onrender.com
```

Share that Render link with employees.

## Automatic 7-Day Cleanup

The app automatically deletes records older than 7 days.
It checks on app startup, once per day while running, and when admin logs in.

Admin also sees:

```text
Auto-delete records after 7 days: Enabled
Clean old records now
```
