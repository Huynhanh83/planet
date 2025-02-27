import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { RatingService } from '../shared/forms/rating.service';
import { UserService } from '../shared/user.service';
import { PlanetMessageService } from '../shared/planet-message.service';
import { StateService } from '../shared/state.service';
import { TagsService } from '../shared/forms/tags.service';
import { dedupeShelfReduce, arraySubField } from '../shared/utils';
import { CouchService } from '../shared/couchdb.service';

@Injectable({
  providedIn: 'root'
})
export class ResourcesService {
  private dbName = 'resources';
  private resourcesUpdated = new Subject<any>();
  resources = { local: [], parent: [] };
  ratings = { local: [], parent: [] };
  tags = { local: [], parent: [] };
  isActiveResourceFetch = false;

  constructor(
    private ratingService: RatingService,
    private userService: UserService,
    private planetMessageService: PlanetMessageService,
    private stateService: StateService,
    private tagsService: TagsService,
    private couchService: CouchService
  ) {
    this.ratingService.ratingsUpdated$.subscribe((res: any) => {
      const planetField = res.parent ? 'parent' : 'local';
      this.ratings[planetField] = res.ratings.filter((rating: any) => rating.type === 'resource');
      if (!this.isActiveResourceFetch) {
        this.setResources(this.resources[planetField], res.ratings, planetField);
      }
    });
    this.stateService.couchStateListener(this.dbName).subscribe(response => {
      if (response !== undefined) {
        this.isActiveResourceFetch = false;
        const resources = response.newData.map((resource: any) => ({ doc: resource, _id: resource._id, _rev: resource._rev }));
        this.setResources(resources, this.ratings[response.planetField], response.planetField);
      }
    });
    this.stateService.couchStateListener('tags').subscribe(response => {
      if (response !== undefined) {
        this.tags[response.planetField] = response.newData.map(this.tagsService.fillSubTags);
        this.setTags(this.resources[response.planetField], this.tags[response.planetField], response.planetField);
      }
    });
  }

  resourcesListener(parent: boolean) {
    return this.resourcesUpdated.pipe(
      map((resources: any) => parent ? resources.parent : resources.local)
    );
  }

  requestResourcesUpdate(parent: boolean, fetchRating: boolean = true) {
    this.isActiveResourceFetch = true;
    this.stateService.requestData(this.dbName, parent ? 'parent' : 'local', { 'title': 'asc' });
    this.stateService.requestData('tags', parent ? 'parent' : 'local');
    if (fetchRating) {
      this.ratingService.newRatings(parent);
    }
  }

  setResources(resources, ratings, planetField) {
    this.setTags(resources, this.tags[planetField], planetField);
    this.resources[planetField] = this.ratingService.createItemList(this.resources[planetField], ratings);
    this.updateResources(this.resources);
  }

  setTags(resources, tags, planetField) {
    this.resources[planetField] = this.tagsService.attachTagsToDocs(this.dbName, resources, tags);
    this.updateResources(this.resources);
  }

  updateResources(resources) {
    if (!this.isActiveResourceFetch) {
      this.resourcesUpdated.next(resources);
    }
  }

  getRatings(resourceIds: string[], opts: any) {
    return this.ratingService.getRatings({ itemIds: resourceIds, type: 'resource' }, opts);
  }

  libraryAddRemove(resourceIds, type) {
    return this.userService.changeShelf(resourceIds, 'resourceIds', type).pipe(map(({ shelf, countChanged }) => {
      const message = type === 'remove' ?
        countChanged + ' Resources successfully removed from myLibrary' : countChanged + ' Resources added to your dashboard';
      this.planetMessageService.showMessage(message);
      return shelf;
    }));
  }

  updateResourceTags(resourceIds, tagIds, indeterminateIds = []) {
    return this.tagsService.updateManyTags(
      this.resources.local, this.dbName, { selectedIds: resourceIds, tagIds, indeterminateIds }
    ).pipe(map((res) => {
      this.requestResourcesUpdate(false);
      return res;
    }));
  }

}
