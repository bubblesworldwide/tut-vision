import { Injectable, inject } from '@angular/core'; //injectable marks the class, inject grabs other services
import { AuthService } from './auth.service'; //where we get the access token from
import { API_BASE } from './auth.config'; //where the express api lives

//the three values the db CHECK allows for availability
export type Availability = 'available' | 'busy' | 'unavailable';
//the two values the db CHECK allows for presence
export type Presence = 'on_campus' | 'off_campus';

//one staff member on the dashboard — matches what the endpoint SELECTs
export interface DashboardStaff {
  name: string; //the lecturer's name
  availability: Availability; //their current availability
  presence: Presence; //on or off campus
  message: string | null; //active status message, or null (LEFT JOIN can return nothing)
}

//one slot in a staff member's weekly schedule
export interface Slot {
  id: number; //needed for PUT /slots/:id and DELETE /slots/:id
  day_of_week: number; //0 = sunday ... 6 = saturday, enforced by a db CHECK
  start_time: string; //'14:00:00'
  end_time: string; //'16:00:00'
}

//the full staff profile from GET /api/staff/:id
export interface StaffProfile {
  name: string; //their name
  email: string; //their email
  availability: Availability | null; //null if they have no status row yet
  presence: Presence | null; //null if they have no status row yet
  message: string | null; //active message, or null
  schedule: Slot[]; //their consultation slots
}

@Injectable({ providedIn: 'root' }) //one shared instance for the whole app
export class ApiService {
  private auth = inject(AuthService); //we need tokens for every call

  //one place that attaches the token, sends the request, and turns failures into real errors
  private async request<T>(
    path: string, //e.g. '/api/departments/1/dashboard'
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', //defaults to GET when not given
    body?: unknown, //optional json payload for writes
  ): Promise<T> { //<T> = "caller says what type comes back"
    const token = await this.auth.getToken(); //silent refresh if the old one expired

    const response = await fetch(`${API_BASE}${path}`, { //build the full url
      method, //shorthand for method: method
      headers: {
        Authorization: `Bearer ${token}`, //the header requireAuth reads
        ...(body ? { 'Content-Type': 'application/json' } : {}), //only send this header when there IS a body
      },
      ...(body ? { body: JSON.stringify(body) } : {}), //turn the object into a json string
    });

    if (!response.ok) { //fetch does NOT throw on 401/403/404/500 — only on network failure
      throw new Error(`${response.status} ${response.statusText}`); //so we throw ourselves
    }

    return response.json() as Promise<T>; //parse the json body and hand it back
  }

  //GET the staff of one department with their live status
  getDashboard(departmentId: number): Promise<DashboardStaff[]> {
    return this.request<DashboardStaff[]>(`/api/departments/${departmentId}/dashboard`);
  }

  //GET one staff member's full profile, including status and schedule
  getStaff(userId: string): Promise<StaffProfile> {
    return this.request<StaffProfile>(`/api/staff/${userId}`);
  }

  //PUT a new availability + presence — BOTH are required, the route has no COALESCE
  setStatus(userId: string, availability: Availability, presence: Presence): Promise<unknown> {
    return this.request(`/api/users/${userId}/status`, 'PUT', { availability, presence });
  }

  //POST a new status message
  postMessage(userId: string, text: string): Promise<unknown> {
    return this.request(`/api/users/${userId}/messages`, 'POST', { text });
  }

  //DELETE (soft-clear) the active status messages
  clearMessages(userId: string): Promise<unknown> {
    return this.request(`/api/users/${userId}/messages`, 'DELETE');
  }

  //POST a new consultation slot — guarded by requireSelf (the url holds OUR user id)
  createSlot(userId: string, dayOfWeek: number, startTime: string, endTime: string): Promise<Slot> {
    return this.request<Slot>(`/api/users/${userId}/slots`, 'POST', { dayOfWeek, startTime, endTime });
  }

  //PUT changes to one slot — guarded by requireOwner, which looks the row up in the db
  updateSlot(slotId: number, changes: Partial<{ dayOfWeek: number; startTime: string; endTime: string }>): Promise<Slot> {
    return this.request<Slot>(`/api/slots/${slotId}`, 'PUT', changes); //Partial<> = every field optional, the route COALESCEs
  }

  //DELETE one slot — guarded by requireOwner
  deleteSlot(slotId: number): Promise<unknown> {
    return this.request(`/api/slots/${slotId}`, 'DELETE');
  }
}