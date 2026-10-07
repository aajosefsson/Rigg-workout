# Rigg Workout

Rigg Workout is a web app for planning and logging training sessions. It covers group classes and private plans for individual clients. Built with React + Vite on Firebase (Firestore + Authentication) and deployed to Vercel from `main`.

## Running locally

```sh
npm install
cp .env.example .env   # then fill in the Firebase config values
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Roles

- **Admin**: plans the group classes (periods, sessions, participants, member roster), invites coaches and clients, and manages everyone in the organization.
- **Coach**: invites clients and plans private sessions for their own clients.
- **Client**: sees their own plan and logs their results.

The **Home** page (workout of the day and class results) is public and needs no account.

## Firestore rules

The security rules live in [`firestore.rules`](firestore.rules). They are **not** deployed automatically. After changing the file, publish it by hand in the Firebase Console: **Firestore → Rules → paste → Publish**.
