import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { routes } from "./routes";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideRouter(routes, withComponentInputBinding())],
}).catch((err) => console.error(err));

