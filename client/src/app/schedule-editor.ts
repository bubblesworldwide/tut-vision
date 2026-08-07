import { Component, OnInit, inject, input, signal } from '@angular/core'; //input = data passed in from a parent
import { ApiService } from './api.service'; //our api wrapper
import type { Slot } from './api.service'; //the slot shape, type only

@Component({
  selector: 'app-schedule-editor', //the tag a parent uses: <app-schedule-editor />
  templateUrl: './schedule-editor.html', //markup in its own file
  styleUrl: './schedule-editor.scss', //styles too
})
export class ScheduleEditor implements OnInit { //OnInit = run something when this component loads
  private api = inject(ApiService); //ask angular for the shared ApiService

  readonly userId = input.required<string>(); //the parent must pass the signed-in user's db id

  //day_of_week is 0-6 in the db, so the array INDEX is the value we send
  protected readonly dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  //reactive state — the template re-renders whenever any of these change
  protected readonly slots = signal<Slot[]>([]); //the slots we loaded
  protected readonly loading = signal(true); //true while loading the list
  protected readonly busy = signal(false); //true while a write is in flight
  protected readonly error = signal<string | null>(null); //last error message, if any

  //the "add a slot" form fields
  protected readonly newDay = signal(1); //default to monday
  protected readonly newStart = signal('09:00'); //sensible default
  protected readonly newEnd = signal('10:00'); //sensible default

  //runs once when the component first appears
  async ngOnInit(): Promise<void> {
    await this.load(); //go and fetch the slots
  }

  //fetch our profile and keep just the schedule from it
  async load(): Promise<void> {
    this.loading.set(true); //show the loading line
    this.error.set(null); //clear any previous error

    try {
      const profile = await this.api.getStaff(this.userId()); //() reads the input signal
      this.slots.set(profile.schedule ?? []); //?? = empty list if the key is missing
    } catch (err) { //network failure, 403, etc
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    } finally {
      this.loading.set(false); //hide the loading line either way
    }
  }

  //create a slot from the form fields
  async addSlot(): Promise<void> {
    this.busy.set(true); //disable the form while we work
    this.error.set(null); //clear any previous error

    try {
      await this.api.createSlot(this.userId(), this.newDay(), this.newStart(), this.newEnd());
      await this.load(); //reload so the new slot appears in the right sorted position
    } catch (err) { //400 if end_time <= start_time — the db CHECK rejects it
      this.error.set(this.explain(err)); //turn it into something a human can act on
    } finally {
      this.busy.set(false); //re-enable the form either way
    }
  }

  //remove one slot
  async removeSlot(slotId: number): Promise<void> {
    this.busy.set(true); //disable the form while we work
    this.error.set(null); //clear any previous error

    try {
      await this.api.deleteSlot(slotId); //requireOwner checks the db that this slot is ours
      this.slots.update(list => list.filter(s => s.id !== slotId)); //drop it locally, no reload needed
    } catch (err) { //403 if it isn't ours, 404 if it's already gone
      this.error.set(this.explain(err)); //show why
    } finally {
      this.busy.set(false); //re-enable
    }
  }

  //keep the form signals in sync as the user types/selects
  protected onDay(event: Event): void { //fired by the <select>
    const target = event.target as HTMLSelectElement; //tell typescript what element it is
    this.newDay.set(Number(target.value)); //the value arrives as a string, the api wants a number
  }

  protected onStart(event: Event): void { //fired by the start <input type="time">
    const target = event.target as HTMLInputElement; //tell typescript what element it is
    this.newStart.set(target.value); //'09:00'
  }

  protected onEnd(event: Event): void { //fired by the end <input type="time">
    const target = event.target as HTMLInputElement; //tell typescript what element it is
    this.newEnd.set(target.value); //'10:00'
  }

  //'14:00:00' from postgres → '14:00' for display
  protected shortTime(time: string): string {
    return time.slice(0, 5); //keep the first five characters
  }

  //turn a raw http error into something worth reading
  private explain(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err); //get the message out
    if (text.startsWith('400')) return 'Could not save — end time must be after start time.'; //the db CHECK
    if (text.startsWith('403')) return 'That slot is not yours.'; //requireOwner blocked it
    return text; //anything else, show it raw
  }
}