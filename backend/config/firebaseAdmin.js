const admin = require('firebase-admin');
const env = require('./env');

function hasFirebaseAdminConfig() {
  return Boolean(
    env.firebase.projectId &&
      env.firebase.privateKey &&
      env.firebase.clientEmail
  );
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) return admin;

  if (!hasFirebaseAdminConfig()) {
    console.warn('Missing Firebase Admin environment variables. Auth verification will fail.');
    return admin;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey.replace(/\\n/g, '\n'),
      }),
    });

    console.log('Firebase Admin initialized');
  } catch (err) {
    console.error('Firebase Admin init error:', err.message);
  }

  return admin;
}

module.exports = initializeFirebaseAdmin();