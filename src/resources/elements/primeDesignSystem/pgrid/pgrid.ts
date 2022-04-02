import { bindable, computedFrom, autoinject, View } from "aurelia-framework";
import { customElement } from "aurelia-framework";
import { InlineViewStrategy } from "aurelia-templating";
import "./pgrid.scss";
import { SortOrder, SortService } from "services/SortService";
import { Utils } from "services/utils";

export interface IGridColumn {
  field: string;
  headerText?: string;
  sortable?: boolean;
  width: string;
  headerClass?: string;
  align?: string;
  template?: string;
}

@autoinject
@customElement("pgrid")
export class PGrid {
  @bindable id?: string;
  @bindable condensed = false;
  @bindable public rows: [] = [];
  @bindable public columns: IGridColumn[] = [];
  @bindable public selectable = false;
  sortColumn: string;
  sortDirection: SortOrder;
  sortEvaluator: (a: any, b: any) => number;
  parent: View;

  constructor() {
    // you can inject the element or any DI in the constructor
  }

  created(owningView: View) {
    this.parent = owningView;
  }

  getBuffedVm(row: any) {
    return { ...this.parent.bindingContext, ...row, row: row };
  }

  sort(columnName: string) {
    if (this.sortColumn === columnName) {
      this.sortDirection = SortService.toggleSortOrder(this.sortDirection);
    } else {
      this.sortColumn = columnName;
    }
    this.sortEvaluator = (a, b) =>
      !isNaN(Utils.getPropertyFromString(a, columnName)) ?
        SortService.evaluateNumber(Utils.getPropertyFromString(a, columnName), Utils.getPropertyFromString(b, columnName), this.sortDirection) :
        Utils.getPropertyFromString(a, columnName) instanceof Date ?
          SortService.evaluateDateTimeAsDate(Utils.getPropertyFromString(a, columnName), Utils.getPropertyFromString(b, columnName), this.sortDirection) :
          SortService.evaluateString(Utils.getPropertyFromString(a, columnName), Utils.getPropertyFromString(b, columnName), this.sortDirection);
  }

  viewStrategy(html: string) {
    return new InlineViewStrategy(!html.startsWith("<template>") ? `<template>${html}</template>` : html);
  }

  @computedFrom("columns")
  get gridTemplateColumnText() {
    return this.columns?.map(y => y.width).join(" ");
  }

}
