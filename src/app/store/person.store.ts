import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { ComponentStore } from '@ngrx/component-store';
import { StarsWarsWebService } from 'src/app/service/star-wars.web-service';
import { Person } from 'src/app/models/person';

export interface PersonState {
  people: Person[];
  editId?: number;
  editedPerson?: Person;
}

// Storeの初期値を設定する。
const defaultState: PersonState = {
  people: [],
  editId: undefined,
  editedPerson: undefined,
};

@Injectable()
export class PersonStore
  extends ComponentStore<PersonState>
  implements OnDestroy
{
  private saveEditPerson$ = new Subject<void>();
  private sub: Subscription = new Subscription();
  constructor(private starsWarsWebService: StarsWarsWebService) {
    super(defaultState);

    // 編集済みPerson情報とid情報をまとめて保存する。
    const saveData$ = this.saveEditPerson$.pipe(
      withLatestFrom(this.editedPerson$, this.editId$),
      switchMap(([, person, editId]) =>
        this.starsWarsWebService.savePerson(person, editId)
      )
    );

    // Person情報をアップデートする。
    this.sub.add(
      saveData$.subscribe({
        next: (person) => {
          // Person情報をアップデートする。
          this.editPerson(person);

          // 編集済みのPerson情報を空にする。
          this.clearEditedPerson();
        },
        // エラーが発生した場合は、ログに表示する。
        error: (error) => {
          console.log(error);
        },
      })
    );
  }

  // unsubscribe()の処理を実装する。
  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  // 現在のPersonの値をStoreから取得する。
  readonly people$: Observable<Person[]> = this.select(({ people }) => people);

  // 変更するID情報をStoreから取得する。
  readonly editId$: Observable<number | undefined> = this.select(
    ({ editId }) => editId
  );

  // 編集済みPerson情報をStoreから取得する。かつ値のログを表示する。
  readonly editedPerson$: Observable<Person | undefined> = this.select(
    ({ editedPerson }) => editedPerson
  ).pipe(
    tap((Person) => {
      console.log('editedPerson:', Person);
    })
  );

  // Personの値をアップデートする。
  readonly loadPeople = this.updater((state, people: Person[] | null) => ({
    ...state,
    people: people || [],
  }));

  // ID情報をアップデートする。
  readonly setEditId = this.updater((state, editId: number | undefined) => ({
    ...state,
    editId,
  }));

  // 編集するerson情報をアップデートする。
  readonly setEditedPerson = this.updater(
    (state, editedPerson: Person | undefined) => ({
      ...state,
      editedPerson,
    })
  );

  // 編集予定のID情報を取得して、既存のPerson情報のIDと一致すれば、
  // そのPerson情報の編集内容を保存する。
  readonly editPerson = this.effect(
    (personId$: Observable<number | undefined>) =>
      personId$.pipe(
        // Observableを結合する。
        withLatestFrom(this.people$),
        tap<[number | undefined, Person[]]>(([id, people]) => {
          this.setEditId(id);

          // 編集予定のID情報を格納する。
          // ID情報がなければundefinedを格納、そうでなければPerson情報から該当のID情報を取得する。
          const personToEdit: Person | undefined =
            !id && id !== 0
              ? undefined
              : people.find((person) => person.id === id);

          this.setEditedPerson({ ...(personToEdit as any) });
        })
      )
  );

  /**
   * 編集予定のPerson情報をキャンセルする。
   * @returns {*}
   */
  public cancelEditPerson(): any {
    this.clearEditedPerson();
  }

  /**
   * Person情報を保存する。
   * @returns {*}
   */
  public saveEditPerson(): any {
    this.saveEditPerson$.next();
  }

  /**
   * 更新情報を空にする。
   * @returns {*}
   */
  private clearEditedPerson(): any {
    this.setEditId(undefined);
    this.setEditedPerson(undefined);
  }
}
