import { Hash } from "services/EthereumService";

export interface IDiscussion {
  createdBy: string,
  createdOn: Date,
  admins: Array<string>,
  members: Array<string>,
  isPublic: boolean,
  clauseHash: string | null,
  clauseIndex: number | null,
  topic: string,
  replies: number,
  modifiedAt: Date,
}

export interface IComment {
  // Following the comment structure of `theconvo.space` api:
  _id: string,
  text: string,
  author: string,
  authorName?: string,
  metadata: any,
  replyTo?: string,
  upvotes: Array<string>,
  downvotes: Array<string>,
  timestamp: number,
}

export interface IProfile {
  address: string,
  image: string,
  name: string,
}

export type TCommentDictionary = {
  [key: string]: IComment
}

export enum VoteType {
  "upvote",
  "downvote"
}

export interface IDealDiscussion {
  version: string;
  discussionId: Hash;
  createdAt: string | null;
  modifiedAt: string | null;
  createdBy: {
    address: string,
    name?: string | null;
  } | null;
  representatives: Array<{address: string}>;
  admins: Array<{address: string}>;
  topic: string;
  clauseIndex: number | null;
  clauseId: string | null;
  replies: number;
  key: string;
  dealId: string;
}

export class DealDiscussion implements IDealDiscussion {
  public discussionId: Hash;
  public version: string;
  public isPrivate: boolean;
  public createdAt: string | null;
  public modifiedAt: string | null;
  public createdBy: {address: string, name?: string | null} | null;
  public clauseId: string;
  public representatives: Array<{address: string}>;
  public admins: Array<{address: string}>;
  public topic: string;
  // public clauseHash: string | null;
  public clauseIndex: number | null;
  public replies: number;
  public key: string;
  public dealId: string;
}
