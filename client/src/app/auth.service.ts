import { Injectable } from '@angular/core'; //marks this class as something angular can inject
import { PublicClientApplication } from '@azure/msal-browser'; //the microsoft auth library
import type { AccountInfo } from '@azure/msal-browser'; //type only — erased at build time

import { TENANT_ID, CLIENT_ID, API_SCOPE } from './auth.config'; //our ids from the config file

@Injectable({ providedIn: 'root' }) //one shared instance for the whole app
export class AuthService {
  //build the msal client once, when the service is first created
  private msal = new PublicClientApplication({
    auth: {
      clientId: CLIENT_ID, //identifies this app to microsoft
      authority: `https://login.microsoftonline.com/${TENANT_ID}`, //single-tenant sign-in endpoint
      redirectUri: window.location.origin, //come back to the APP itself — redirect flow needs angular to boot
    },
    cache: {
      cacheLocation: 'sessionStorage', //tokens live for this tab only, cleared when it closes
    },
  });

  private ready = false; //msal refuses every other call until initialize() has run

  //initialise msal and process any redirect we just came back from — exactly once
  private async ensureReady(): Promise<void> {
    if (this.ready) return; //already done, nothing to do
    await this.msal.initialize(); //required by msal-browser v3+

    const result = await this.msal.handleRedirectPromise(); //reads the auth response out of the url if we just returned from microsoft
    if (result?.account) { //we did come back from a sign-in
      this.msal.setActiveAccount(result.account); //remember who signed in
    }

    this.ready = true; //remember so we never repeat it
  }

  //send the whole page to microsoft to sign in — this navigates away and does NOT return
  async login(): Promise<void> {
    await this.ensureReady(); //msal must be initialised first
    await this.msal.loginRedirect({ scopes: [API_SCOPE] }); //browser leaves for microsoft, comes back to redirectUri
  }

  //who is signed in, or null if nobody
  async getAccount(): Promise<AccountInfo | null> {
    await this.ensureReady(); //also processes the redirect response on first call after returning
    return this.msal.getActiveAccount() ?? this.msal.getAllAccounts()[0] ?? null; //?? = fall through on null/undefined
  }

  //returns a valid access token, refreshing quietly when it can
  async getToken(): Promise<string> {
    await this.ensureReady(); //msal must be initialised first
    const account = await this.getAccount(); //we need an account to refresh against
    if (!account) throw new Error('Not signed in'); //caller must login() first

    try {
      const result = await this.msal.acquireTokenSilent({ scopes: [API_SCOPE], account }); //no interaction — uses the cached refresh token
      return result.accessToken; //the string that goes in the Authorization header
    } catch {
      await this.msal.acquireTokenRedirect({ scopes: [API_SCOPE], account }); //silent failed — send the page to microsoft again
      throw new Error('Redirecting to sign in'); //we're navigating away; nothing to return
    }
  }

  //sign out and clear the cached tokens
  async logout(): Promise<void> {
    await this.ensureReady(); //msal must be initialised first
    await this.msal.logoutRedirect(); //clears the cache and signs out at microsoft
  }
}