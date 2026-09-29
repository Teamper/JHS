// @ts-check

import { SelectionModel } from "../../core/selection-model.js";
import { normalizeMovieCarNum } from "../../core/movie-identity.js";

export class HistorySelectionModel extends SelectionModel {
    constructor() { super((item) => normalizeMovieCarNum(item?.carNum) ?? String(item?.id ?? "")); }
}
