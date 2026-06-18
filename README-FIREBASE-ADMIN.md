# Firebase Admin Upgrade

New pages added:

- `/login.html` user/admin login
- `/admin.html` admin dashboard
- `/firebase-config.js` Firebase configuration

## Setup

1. Open `public/firebase-config.js`.
2. Replace the placeholder Firebase config with your Web App config.
3. In Firestore create these collections:
   - `admins` with your email, role `superadmin`, active `true`
   - `products`
   - `orders`
   - `transactions`
   - `users`
4. In Firebase Authentication enable Email/Password and Google.
5. Deploy to Render again.

Admin link:

`https://your-domain.com/admin.html`

Login link:

`https://your-domain.com/login.html`
