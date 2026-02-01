import { Component, EventEmitter, Input, Output, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Observable, Subject, debounceTime, switchMap, of, catchError } from "rxjs";

@Component({
  selector: "app-typeahead",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="typeahead-container">
      <input
        [ngModel]="inputValue"
        (ngModelChange)="onInput($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        [placeholder]="placeholder"
        [required]="required"
        class="typeahead-input"
      />
      <div *ngIf="isOpen() && results().length" class="typeahead-results">
        <div
          *ngFor="let result of results()"
          (mousedown)="select(result)"
          class="typeahead-item"
        >
          {{ formatter(result) }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .typeahead-container { position: relative; width: 100%; }
    .typeahead-input { 
      width: 100%; 
      padding: 10px 12px; 
      box-sizing: border-box; 
      color: var(--text); 
      background: rgba(0,0,0,0.2); 
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .typeahead-input:required:invalid {
      border-color: rgba(220, 53, 69, 0.5);
    }
    .typeahead-input:required:valid {
      border-color: rgba(40, 167, 69, 0.3);
    }
    .typeahead-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .typeahead-item {
      padding: 10px 12px;
      cursor: pointer;
      color: var(--text);
      font-size: 14px;
    }
    .typeahead-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--accent);
    }
  `]
})
export class TypeaheadComponent<T> {
  @Input() searchFn!: (query: string) => Observable<T[]>;
  @Input() formatter: (item: T) => string = (item: any) => String(item);
  @Input() placeholder = "";
  @Input() required = false;
  @Input() set initialValue(val: string | null) {
    // Always update inputValue, including when null (to clear the field)
    this.inputValue = val || "";
  }
  @Output() selected = new EventEmitter<T>();
  @Output() queryChange = new EventEmitter<string>();

  inputValue = "";
  results = signal<T[]>([]);
  isOpen = signal(false);

  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      switchMap(q => {
        // Treat "*" as wildcard to show all results
        const searchQuery = q === "*" ? "" : q;
        if (!q) return of([]);
        return this.searchFn(searchQuery).pipe(catchError(() => of([])));
      })
    ).subscribe(results => {
      this.results.set(results);
      this.isOpen.set(results.length > 0);
    });
  }

  onInput(value: string) {
    this.inputValue = value;
    this.queryChange.emit(value);
    this.searchSubject.next(value);
  }

  onFocus() {
    if (this.inputValue) {
      this.searchSubject.next(this.inputValue);
    }
  }

  onBlur() {
    // Delay hiding to allow click event to register
    setTimeout(() => this.isOpen.set(false), 200);
  }

  select(item: T) {
    this.inputValue = this.formatter(item);
    this.selected.emit(item);
    this.isOpen.set(false);
  }
}
