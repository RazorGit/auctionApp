import { TestBed } from "@angular/core/testing";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { DashboardComponent } from "./dashboard.component";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

describe("DashboardComponent", () => {
  it("creates", async () => {
    await TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
}).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

