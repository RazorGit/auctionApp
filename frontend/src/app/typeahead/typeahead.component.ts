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
    .typeahead-input { width: 100%; padding: 8px; box-sizing: border-box; }
    .typeahead-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ccc;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .typeahead-item {
      padding: 8px;
      cursor: pointer;
    }
    .typeahead-item:hover {
      background: #f0f0f0;
    }
  `]
})
export class TypeaheadComponent<T> {
    @Input() searchFn!: (query: string) => Observable<T[]>;
    @Input() formatter: (item: T) => string = (item: any) => String(item);
    @Input() placeholder = "";
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
                if (!q) return of([]);
                return this.searchFn(q).pipe(catchError(() => of([])));
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
