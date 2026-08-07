import { Injectable, inject } from '@angular/core'; //injectable marks the class, inject grabs other services
import { AuthService } from './auth.service'; //where we get the access token from
import { API_BASE } from './auth.config'; //where the express api lives

//the shape of one staff member on the dashboard — matches what the endpoint SELECTs
export interface DashboardStaff {
  name: string; //the lecturer's name
  availability: 'available' | 'busy' | 'unavailable'; //the three values the db CHECK allows
  presence: 'on_campus' | 'off_campus'; //the two values the db CHECK allows
  message: string | null; //their active status message, or null (LEFT JOIN can return nothing)
}

@Injectable({ providedIn: 'root' }) //one shared instance for the whole app
export class ApiService {
  private auth = inject(AuthService); //we need tokens for every call

  //one place that attaches the token, calls the api, and turns failures into real errors
  private async request<T>(path: string): Promise<T> { //<T> = "caller says what type comes back"
    const token = await this.auth.getToken(); //silent refresh if the old one expired

    const response = await fetch(`${API_BASE}${path}`, { //build the full url
      headers: { Authorization: `Bearer ${token}` }, //the header requireAuth reads
    });

    if (!response.ok) { //fetch does NOT throw on 401/403/404/500 — only on network failure
      throw new Error(`${response.status} ${response.statusText}`); //so we throw ourselves
    }

    return response.json() as Promise<T>; //parse the json body and hand it back
  }

  //GET the staff of one department with their live status
  getDashboard(departmentId: number): Promise<DashboardStaff[]> { //returns an array of staff
    return this.request<DashboardStaff[]>(`/api/departments/${departmentId}/dashboard`); //the endpoint you built and tested
  }
}