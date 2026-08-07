import { Component, OnInit, inject, signal } from '@angular/core'; //component, lifecycle hook, DI helper, reactive state
import { RouterOutlet } from '@angular/router'; //placeholder where routed pages will render later
import { JsonPipe } from '@angular/common'; //lets the template pretty-print an object with | json

import { AuthService } from './auth.service'; //our msal wrapper
import { API_BASE } from './auth.config'; //where the express api lives

@Component({
  selector: 'app-root', //the tag index.html renders
  imports: [RouterOutlet, JsonPipe], //standalone components must list everything the template uses
  templateUrl: './app.html', //markup lives in its own file
  styleUrl: './app.scss', //styles too
})
export class App implements OnInit { //OnInit = "run something when this component first loads"
  private auth = inject(AuthService); //ask angular for the shared AuthService instance

  //signals hold reactive state — the template re-renders itself whenever one changes
  protected readonly account = signal<string | null>(null); //who is signed in, or null
  protected readonly me = signal<unknown>(null); //whatever /api/me returned
  protected readonly error = signal<string | null>(null); //last error message, if any
  protected readonly busy = signal(false); //true while a request is in flight

  //runs once when the app loads — including right after coming back from microsoft
  async ngOnInit(): Promise<void> {
    const acct = await this.auth.getAccount(); //this also processes the redirect response
    if (acct) { //we ARE signed in
      this.account.set(acct.username); //show which account
      await this.loadMe(); //and fetch our api data straight away
    }
  }

  //send the page to microsoft to sign in
  async signIn(): Promise<void> {
    this.error.set(null); //clear any previous error
    this.busy.set(true); //disable the button while we navigate away

    try {
      await this.auth.login(); //browser leaves this page — nothing runs after this
    } catch (err) { //config problem, blocked navigation, etc
      this.error.set(err instanceof Error ? err.message : String(err)); //show why it failed
      this.busy.set(false); //re-enable the button
    }
  }

  //call GET /api/me with the access token attached
  async loadMe(): Promise<void> {
    this.error.set(null); //clear any previous error

    try {
      const token = await this.auth.getToken(); //silent refresh if possible

      const response = await fetch(`${API_BASE}/api/me`, { //fetch = the browser's built-in http client
        headers: { Authorization: `Bearer ${token}` }, //exactly what curl was sending
      });

      if (!response.ok) { //fetch does NOT throw on 401/403/500 — only on network failure
        throw new Error(`API returned ${response.status}`); //so we throw ourselves
      }

      this.me.set(await response.json()); //parse the json body and store it
    } catch (err) { //network error, or the throw above
      this.error.set(err instanceof Error ? err.message : String(err)); //show why it failed
    }
  }

  //sign out and clear what we're showing
  async signOut(): Promise<void> {
    await this.auth.logout(); //navigates to microsoft to sign out
  }
}