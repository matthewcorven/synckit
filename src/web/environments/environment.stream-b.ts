export const environment = {
  production: false,
  apiPort: 5200,
  useMocks: true,
  auth: {
    clientId: '79e059f9-a911-45d6-91c3-10c5cba11015',
    authority: 'https://dgmvp.b2clogin.com/dgmvp.onmicrosoft.com/B2C_1_SignUpSignIn',
    redirectUri: 'http://localhost:4201/',
    scopes: ['api://dgmvp/access_as_user'],
    knownAuthorities: ['dgmvp.b2clogin.com']
  }
};
