import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { DashboardComponent } from "./dashboard.component";

describe("DashboardComponent", () => {
  it("creates", async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, DashboardComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

