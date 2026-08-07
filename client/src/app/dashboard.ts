import { Component, inject, input, signal, OnInit } from '@angular/core'; //input = data passed in from a parent component
import { ApiService } from './api.service'; //our api wrapper
import type { DashboardStaff } from './api.service'; //the row shape, type only

@Component({
  selector: 'app-dashboard', //the tag a parent uses: <app-dashboard />
  templateUrl: './dashboard.html', //markup in its own file
  styleUrl: './dashboard.scss', //styles too
})
export class Dashboard implements OnInit { //OnInit = run something when this component loads
  private api = inject(ApiService); //ask angular for the shared ApiService

  //the parent passes the department id in: <app-dashboard [departmentId]="1" />
  readonly departmentId = input.required<number>(); //required = angular errors if the parent forgets

  //reactive state — the template re-renders whenever any of these change
  protected readonly staff = signal<DashboardStaff[]>([]); //the rows we got back, empty to start
  protected readonly loading = signal(true); //true while the request is in flight
  protected readonly error = signal<string | null>(null); //last error message, if any

  //runs once when the component first appears on screen
  async ngOnInit(): Promise<void> {
    await this.load(); //go and fetch the data
  }

  //fetch the dashboard for this department
  async load(): Promise<void> {
    this.loading.set(true); //show the loading line
    this.error.set(null); //clear any previous error

    try {
      const rows = await this.api.getDashboard(this.departmentId()); //call the api — note the () to READ the input signal
      this.staff.set(rows); //store the rows so the template renders them
    } catch (err) { //network failure, 401, 403...
      this.error.set(err instanceof Error ? err.message : String(err)); //show why
    } finally {
      this.loading.set(false); //hide the loading line either way
    }
  }

  //turn an availability value into a css class name
  protected dotClass(availability: string): string { //called from the template per row
    return `dot ${availability}`; //e.g. "dot available" — see dashboard.scss
  }

  //turn a presence value into something a human reads
  protected presenceLabel(presence: string): string { //called from the template per row
    return presence === 'on_campus' ? 'On campus' : 'Off campus'; //ternary: condition ? ifTrue : ifFalse
  }
}