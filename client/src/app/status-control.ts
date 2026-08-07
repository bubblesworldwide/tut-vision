import { Component, OnInit, inject, input, output, signal } from '@angular/core'; //output = send an event UP to the parent
import { ApiService } from './api.service'; //our api wrapper
import type { Availability, Presence } from './api.service'; //the allowed values, types only

@Component({
  selector: 'app-status-control', //the tag a parent uses: <app-status-control />
  templateUrl: './status-control.html', //markup in its own file
  styleUrl: './status-control.scss', //styles too
})
export class StatusControl implements OnInit { //OnInit = run something when this component loads
  private api = inject(ApiService); //ask angular for the shared ApiService

  readonly userId = input.required<string>(); //the parent must pass the signed-in user's db id
  readonly changed = output<void>(); //fires after any successful write, so the parent can refresh

  //the three availability options, in the order we want the buttons
  protected readonly availabilities: Availability[] = ['available', 'busy', 'unavailable'];
  //the two presence options
  protected readonly presences: Presence[] = ['on_campus', 'off_campus'];

  //reactive state — the template re-renders whenever any of these change
  protected readonly availability = signal<Availability>('unavailable'); //current availability
  protected readonly presence = signal<Presence>('off_campus'); //current presence
  protected readonly messageText = signal(''); //what's typed in the textarea
  protected readonly busy = signal(false); //true while a request is in flight
  protected readonly error = signal<string | null>(null); //last error message, if any

  //runs once when the component first appears — load our CURRENT status
  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.api.getStaff(this.userId()); //() reads the input signal
      this.availability.set(profile.availability ?? 'unavailable'); //?? = fall back if there's no status row
      this.presence.set(profile.presence ?? 'off_campus'); //same
      this.messageText.set(profile.message ?? ''); //prefill the textarea with any active message
    } catch (err) { //network failure, 403, etc
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    }
  }

  //send a new availability, keeping the current presence
  async setAvailability(value: Availability): Promise<void> {
    await this.save(value, this.presence()); //both values must go in the same request
  }

  //send a new presence, keeping the current availability
  async setPresence(value: Presence): Promise<void> {
    await this.save(this.availability(), value); //both values must go in the same request
  }

  //the one place that actually writes the status
  private async save(availability: Availability, presence: Presence): Promise<void> {
    this.busy.set(true); //disable the buttons while we work
    this.error.set(null); //clear any previous error

    try {
      await this.api.setStatus(this.userId(), availability, presence); //PUT /api/users/:id/status
      this.availability.set(availability); //only update the ui AFTER the server accepted it
      this.presence.set(presence); //same
      this.changed.emit(); //tell the parent something changed
    } catch (err) { //403 if we somehow aimed at someone else, 400 if a value was invalid
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    } finally {
      this.busy.set(false); //re-enable the buttons either way
    }
  }

  //post whatever is typed in the textarea as a status message
  async postMessage(): Promise<void> {
    const text = this.messageText().trim(); //trim = drop leading/trailing whitespace
    if (!text) return; //nothing typed, nothing to do

    this.busy.set(true); //disable the buttons
    this.error.set(null); //clear any previous error

    try {
      await this.api.postMessage(this.userId(), text); //POST /api/users/:id/messages
      this.changed.emit(); //tell the parent to refresh
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    } finally {
      this.busy.set(false); //re-enable
    }
  }

  //soft-clear the active messages (the rows survive, active goes false)
  async clearMessage(): Promise<void> {
    this.busy.set(true); //disable the buttons
    this.error.set(null); //clear any previous error

    try {
      await this.api.clearMessages(this.userId()); //DELETE /api/users/:id/messages
      this.messageText.set(''); //empty the textarea
      this.changed.emit(); //tell the parent to refresh
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    } finally {
      this.busy.set(false); //re-enable
    }
  }

  //keep the signal in sync as the user types
  protected onType(event: Event): void { //Event is the generic dom event type
    const target = event.target as HTMLTextAreaElement; //tell typescript what element it really is
    this.messageText.set(target.value); //store what's currently typed
  }
}