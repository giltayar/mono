import {z} from 'zod'

export interface RecurringPaymentInfo {
  recurringPaymentId: string
}

export interface BadPayment {
  date: Date
  badPaymentCount: number
}

export const CardcomSaleWebhookJsonSchema = z.looseObject({
  ApprovelNumber: z.string(),
  CardOwnerName: z.string(),
  intTo: z.string().optional(),
  CardOwnerPhone: z.string().optional(),
  CouponNumber: z.string().optional(),
  DealDate: z.string(),
  DealTime: z.string(),
  internaldealnumber: z.string(),
  invoicenumber: z.string(),
  terminalnumber: z.string(),
  responsecode: z.string(),
  UserEmail: z.string(),
  RecurringAccountID: z.string().optional(),

  suminfull: z.string(),

  ProdTotalLines: z.string(),

  ProdPrice: z.string(),
  ProdQuantity: z.string(),
  ProductID: z.string(),

  ProdPrice1: z.string().optional(),
  ProdQuantity1: z.string().optional(),
  ProductID1: z.string().optional(),

  ProdPrice2: z.string().optional(),
  ProdQuantity2: z.string().optional(),
  ProductID2: z.string().optional(),

  ProdPrice3: z.string().optional(),
  ProdQuantity3: z.string().optional(),
  ProductID3: z.string().optional(),

  ProdPrice4: z.string().optional(),
  ProdQuantity4: z.string().optional(),
  ProductID4: z.string().optional(),

  ProdPrice5: z.string().optional(),
  ProdQuantity5: z.string().optional(),
  ProductID5: z.string().optional(),

  ProdPrice6: z.string().optional(),
  ProdQuantity6: z.string().optional(),
  ProductID6: z.string().optional(),

  ProdPrice7: z.string().optional(),
  ProdQuantity7: z.string().optional(),
  ProductID7: z.string().optional(),

  DeliveryCity: z.string().optional(),
  DeliveryStreet: z.string().optional(),
  DeliveryBuilding: z.string().optional(),
  DeliveryApartment: z.string().optional(),
  DeliveryFloor: z.string().optional(),
  DeliveryEntrance: z.string().optional(),
  DeliveryNotes: z.string().optional(),

  RecurringOrderID: z.string().optional(), // for standing orders
})

export type CardcomSaleWebhookJson = z.infer<typeof CardcomSaleWebhookJsonSchema>

export const CardcomStandingOrderBaseJsonSchema = z.looseObject({
  AccountId: z.number().optional(),
  RecurringId: z.number(),
  Secret: z.string().optional(),
})

export const CardcomMasterRecurringJsonSchema = z.looseObject({
  RecordType: z.literal('MasterRecurring'),
  ...CardcomStandingOrderBaseJsonSchema.shape,
  'FlexItem.Price': z.number(),
})

export const CardcomDetailRecurringJsonSchema = z.looseObject({
  RecordType: z.literal('DetailRecurring'),
  ...CardcomStandingOrderBaseJsonSchema.shape,
  Status: z.string(),
  ProductId: z.number(),
  Quantity: z.number(),
  Sum: z.number(),
  InternalDealNumber: z.coerce.string(),
  DocumentNumber: z.number(),
  BillingAttempts: z.number(),
})

export const CardcomRecurringOrderWebHookJsonSchema = z.discriminatedUnion('RecordType', [
  CardcomMasterRecurringJsonSchema,
  CardcomDetailRecurringJsonSchema,
])

export type CardcomRecurringOrderWebHookJson = z.infer<
  typeof CardcomRecurringOrderWebHookJsonSchema
>
export type CardcomMasterRecurringJson = z.infer<typeof CardcomMasterRecurringJsonSchema>
