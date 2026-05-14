
let tokenClient: any;
let authInitialized = false;

// Memory-based caching
let cachedAccessToken: string | null = null;
let tokenExpiryTime: number | null = null; // Timestamp in ms

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

export const initGsi = (clientId: string) => {
  if (authInitialized) return;

  const googleObj = (window as any).google;
  if (!googleObj) {
    console.error('Google GSI library not loaded yet.');
    return;
  }

  tokenClient = googleObj.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES.join(' '),
    callback: (response: any) => {
      if (response.error !== undefined) {
        console.error('GSI Error:', response);
      } else {
        cachedAccessToken = response.access_token;
        const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3600;
        tokenExpiryTime = Date.now() + expiresIn * 1000;
        console.log('Access token acquired');
      }
    },
  });

  authInitialized = true;
};

export const getAccessToken = async (interactive = false): Promise<string> => {
  if (!tokenClient) {
    throw new Error('Auth not initialized. Call initGsi() first.');
  }

  // Check memory cache (valid for at least another 60 seconds)
  if (cachedAccessToken && tokenExpiryTime && (tokenExpiryTime - Date.now() > 60000)) {
    return cachedAccessToken;
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (response: any) => {
      if (response.error !== undefined) {
        if (response.error === 'popup_blocked' || response.error === 'interaction_required') {
          reject(new Error(response.error));
        } else {
          reject(response);
        }
      } else {
        cachedAccessToken = response.access_token;
        const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3600;
        tokenExpiryTime = Date.now() + expiresIn * 1000;
        resolve(response.access_token);
      }
    };

    tokenClient.requestAccessToken(interactive ? {} : { prompt: 'none' });
  });
};

export const isAuthInitialized = () => authInitialized;
