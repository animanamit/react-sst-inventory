/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */

declare module "sst" {
  export interface Resource {
    "AlertsFunction": {
      "name": string
      "type": "sst.aws.Function"
    }
    "AlertsQueue": {
      "type": "sst.aws.Queue"
      "url": string
    }
    "AlertsTable": {
      "name": string
      "type": "sst.aws.Dynamo"
    }
    "ElastiCacheCluster": {
      "host": string
      "password": string
      "port": number
      "type": "sst.aws.Redis"
      "username": string
    }
    "InventoryApi": {
      "type": "sst.aws.ApiGatewayV2"
      "url": string
    }
    "InventoryHistoryTable": {
      "name": string
      "type": "sst.aws.Dynamo"
    }
    "InventoryTable": {
      "name": string
      "type": "sst.aws.Dynamo"
    }
    "InventoryWeb": {
      "type": "sst.aws.React"
      "url": string
    }
    "ProductImagesBucket": {
      "name": string
      "type": "sst.aws.Bucket"
    }
    "ProductsTable": {
      "name": string
      "type": "sst.aws.Dynamo"
    }
    "RedisVpc": {
      "type": "sst.aws.Vpc"
    }
  }
}
/// <reference path="sst-env.d.ts" />

import "sst"
export {}