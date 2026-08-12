import { Component, OnInit, inject, signal, viewChild } from '@angular/core'; //viewChild = get a handle on a child component from the class
import { RouterOutlet } from '@angular/router'; //placeholder where routed pages will render later

import { AuthService } from './auth.service'; //our msal wrapper
import { ApiService } from './api.service'; //our api wrapper
import { API_BASE } from './auth.config'; //where the express api lives
import { Dashboard } from './dashboard'; //the department dashboard component
import { StatusControl } from './status-control'; //the staff status controls
import { ScheduleEditor } from './schedule-editor'; //the consultation slot editor
import { Following } from './following'; //the student's followed-staff list

@Component({
  selector: 'app-root', //the tag index.html renders
  imports: [RouterOutlet, Dashboard, StatusControl, ScheduleEditor, Following], //standalone components must list everything the template uses
  templateUrl: './app.html', //markup lives in its own file
  styleUrl: './app.scss', //styles too
})
export class App implements OnInit { //OnInit = "run something when this component first loads"
  private auth = inject(AuthService); //ask angular for the shared AuthService instance
  private api = inject(ApiService); //and the shared ApiService

  //grab the child components so we can call their methods — undefined until they render
  private dashboard = viewChild(Dashboard); //the department list
  private following = viewChild(Following); //the followed-staff list

  //signals hold reactive state — the template re-renders itself whenever one changes
  protected readonly account = signal<string | null>(null); //who is signed in, or null
  protected readonly departmentId = signal<number | null>(null); //which department to show
  protected readonly userId = signal<string | null>(null); //OUR database id, for the write routes
  protected readonly isStaff = signal(false); //true only if our db row says role = 'staff'
  protected readonly followedIds = signal<string[]>([]); //ids of staff we follow, for the follow buttons
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

      const data = await response.json(); //parse the json body
      this.departmentId.set(data?.user?.department_id ?? null); //which dashboard to load
      this.userId.set(data?.user?.id ?? null); //our db id, needed by the write routes
      this.isStaff.set(data?.user?.role === 'staff'); //role comes from OUR db, not the token

      if (!this.isStaff() && this.userId()) { //students need their follow list for the buttons
        await this.loadFollowedIds(); //so the dashboard can show Follow vs Following
      }
    } catch (err) { //network error, or the throw above
      this.error.set(err instanceof Error ? err.message : String(err)); //show why it failed
    }
  }

  //fetch just the ids of the staff we follow
  private async loadFollowedIds(): Promise<void> {
    const id = this.userId(); //read the signal once
    if (!id) return; //nothing to do if we don't know who we are

    try {
      const rows = await this.api.getFollowing(id); //GET /api/students/:id/following
      this.followedIds.set(rows.map(r => r.id)); //map = turn each row into just its id
    } catch (err) { //403 or a network problem
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    }
  }

  //follow or unfollow, depending on whether we already follow them
  protected async toggleFollow(staffId: string): Promise<void> {
    const id = this.userId(); //read the signal once
    if (!id) return; //nothing to do if we don't know who we are

    this.error.set(null); //clear any previous error

    try {
      if (this.followedIds().includes(staffId)) { //we already follow them
        await this.api.unfollow(id, staffId); //DELETE /api/follows
      } else { //we don't follow them yet
        await this.api.follow(id, staffId); //POST /api/follows
      }

      await this.loadFollowedIds(); //refresh which buttons say "Following"
      this.following()?.load(); //?. = only refresh the list if it's on screen
    } catch (err) { //403 if studentId wasn't our own id, 400 for a duplicate follow
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    }
  }

  //called when the status control reports a successful write
  protected refreshDashboard(): void {
    this.dashboard()?.load(); //?. = only call load() if the dashboard is actually on screen
  }

  //sign out and clear what we're showing
  async signOut(): Promise<void> {
    await this.auth.logout(); //navigates to microsoft to sign out
  }
}