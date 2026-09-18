import {LocalizedError, message} from '../localize/localize.js';
/** @typedef {{id:string,name:string,categoryId:string,categoryName:string,picture:string|null,brightness:number|undefined,raw:object}} Preset */
export function assertRecord(value, kind) {
  if (!value || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string') {
    throw new LocalizedError('error.record', {kind: kind === 'category' ? message('common.category') : 'Preset'});
  }
}
