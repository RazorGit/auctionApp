import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { ApiService } from "./api.service";

describe("ApiService", () => {
  let api: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    api = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("lists events via /api/events", () => {
    api.listEvents().subscribe((rows) => {
      expect(rows.length).toBe(1);
      expect(rows[0].event_desc).toBe("Test");
    });

    const req = httpMock.expectOne("/api/events");
    expect(req.request.method).toBe("GET");
    req.flush([{ event_id: 1, event_locator: "ABC", event_desc: "Test", event_date: "2026-01-28", event_tax_id: null }]);
  });
});

