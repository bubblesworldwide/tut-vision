import { Component, OnInit, inject, input, signal } from '@angular/core'; //input = data passed in from a parent
import { ApiService } from './api.service'; //our api wrapper
import type { FollowedStaff } from './api.service'; //the row shape, type only

@Component({
  selector: 'app-following', //the tag a parent uses: <app-following />
  templateUrl: './following.html', //markup in its own file
  styleUrl: './following.scss', //styles too
})
export class Following implements OnInit { //OnInit = run something when this component loads
  private api = inject(ApiService); //ask angular for the shared ApiService

  readonly studentId = input.required<string>(); //the parent must pass the signed-in student's db id

  //reactive state — the template re-renders whenever any of these change
  protected readonly staff = signal<FollowedStaff[]>([]); //who we follow
  protected readonly loading = signal(true); //true while loading
  protected readonly error = signal<string | null>(null); //last error message, if any

  //runs once when the component first appears
  async ngOnInit(): Promise<void> {
    await this.load(); //go and fetch the list
  }

  //fetch the staff this student follows
  async load(): Promise<void> {
    this.loading.set(true); //show the loading line
    this.error.set(null); //clear any previous error

    try {
      const rows = await this.api.getFollowing(this.studentId()); //() reads the input signal
      this.staff.set(rows); //store the rows so the template renders them
    } catch (err) { //403 if we somehow asked for someone else's list
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    } finally {
      this.loading.set(false); //hide the loading line either way
    }
  }

  //turn an availability value into a css class name
  protected dotClass(availability: string | null): string { //availability can be null here
    return `dot ${availability ?? 'unavailable'}`; //?? = treat "no status row" as unavailable
  }

  //turn a presence value into something a human reads
  protected presenceLabel(presence: string | null): string { //presence can be null here
    if (!presence) return 'Unknown'; //no status row yet
    return presence === 'on_campus' ? 'On campus' : 'Off campus'; //ternary
  }
}