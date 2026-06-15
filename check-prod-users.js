const admin = require('firebase-admin');

const serviceAccount = {
  "type": "service_account",
  "project_id": "hotel-du-manolo-cr",
  "private_key_id": "11848751b5fdc70f695ee71896a7edba36759d50",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDTFZuHvqhWoIZf\nPxtjMBzd1HmdkP9R9srLJtgfOJTgUAEy2gDQSYlV6apLSLFyKbhowPPymOMo4Vzt\nG/mEvf1YDH+my+xL94jT/EGguw50BcW0YbS/nGN1+/xH8kL3CviBQhZussJbNDsP\n+O8FKZ+e9fY9wsvXUdRa8hOcfVYFD+cXFOeAIMcBnwSvHhkUXlAVmdGSLOtn2wyJ\nYc1oxUrhH41/D8A3+6wavOD+zlvzk90Ux1gctbSMEpo4cv5pCcOU5jCxhEbeEdrA\nuwxlj9jw+TIYIBqR2UvlM3hBge73NBIf8Ewr7TzPuMY8CnqBmbEDzVbQvGcQYjfh\nSAYtbr3PAgMBAAECggEAFt6d8bid63jL5jDjqjzxu7UEEia+CubWtOj5/HP4aU8x\nug01jluRRh4hZbO0Cf7sLGlPZObcoba9BzGDOLcO5kXAZNVuPhLNH86SW7Q4jih7\n8Z2uZB4xBnztKexdBgAJyZNb89VpSlFf3sylNOV8FlBmw+1BgYwrmkjlCAzqT3Tl\nsyIaw3G68QV8Q9Om2NQ9+u5ydg+O+UGHXdsZOUINvfq8aoJbsol6zqR/EaT5GRMf\nrYjD98szlFCCx22yoVOeMXWCeerexk7UzlZIYwNwEpztbxUAsPT5ow6gkz+INA3B\ncloc9CqZfJGmK/85R/wp58LXJ9qpJswEgsVyFjZkCQKBgQDzgRI3tha6kC4cyDlY\nPZnjJZOfYhaBjYNoIrZXIWHhjzsYT57tOB7UMtIj1ND4cgSRqEhoy0DnWMx/1zPW\ngQ9gIyu74+GZ3Pi7WGlguxyS0Jh20mQm/vq4A/G+QfvCqLR0tBq9kqDSlTZrJyW6\nfSdDYS6QegmNKEdupukZvm3vmQKBgQDd6qLE7tm0X2YUU7T5yV6+H97GbDl+GpJ1\npLg44mjfoRXa8DXjB3awyHwwurnsXVXxI6/ujxWIso77gIGVOGxV9RVClTwdJKlQ\n1MifPA9UZuYqOkV4BM+89kjcRZKhpABmKjbRs/C5gTlNVwCAX/i273Em1GOIWr/m\nvuNass2ZpwKBgBmPH7lnTIVyotR0k8hWVvPHuvIM2q3oi7V/h0IoB90kKqDHorfl\nnx7I4tPN/81EMoSTdF5Dj2F5KaX1kcRfMZz2tB15svFyh00q34y+tyYV7RrzxH1v\nYCO2jkZZKLLrAF4LlY72eBkCfn7K0iP8BQYGilux45TEeJL9xBPmsCVpAoGBAKSJ\n5EXAEwr58OYBap4KAIVXfAYDGF23tgAkMbN7q+ajuWCr2kiKsCZDgFFhIZlvWtmA\nbGGlFYJVYk536ZyKSUkyfqDvpbK2DBQysM3f6j3aTa3hpsBmUOD6eutXanEO+HzH\nr/2sPUBN3/7IE0cb4X1B69Ouhl4Da2XbAxesm2ThAoGBAKeT4BP+TdHr3G27Cu64\ndHc1eooJDusECg9fiE4hJbxBf+4/lmAQ7EY1EQEoM+A3GyWrqkn0eRoSKNoiA2gL\nWKU/9lGSZLqc+nK3sx3Dto0Zr3WAXM6cUNNmvjHmWWoCrp+DqEHVHfck+T1zJbef\nzCf5FWoawTZwUKn+bqD11JWk\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@hotel-du-manolo-cr.iam.gserviceaccount.com",
  "client_id": "115693339417465746442",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40hotel-du-manolo-cr.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUsers() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\n=== User: ${doc.id} ===`);
    console.log('firstName:', data.firstName);
    console.log('lastName:', data.lastName);
    console.log('email:', data.email);
    console.log('createdAt:', data.createdAt ? (data.createdAt.toDate ? 'Valid Timestamp: ' + data.createdAt.toDate() : 'INVALID TIMESTAMP/STRING: ' + data.createdAt) : 'MISSING');
    console.log('birthDate:', data.birthDate ? (data.birthDate.toDate ? 'Valid Timestamp: ' + data.birthDate.toDate() : 'INVALID TIMESTAMP/STRING: ' + data.birthDate) : 'MISSING');
    console.log('status:', data.status);
    console.log('role:', data.role);
  });
  
  process.exit(0);
}

checkUsers().catch(console.error);
