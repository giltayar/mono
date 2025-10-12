# Instructions

- Create a test in test/integration/cardcom-sale.test.ts.

- Model it after similar tests in test/integration/create-update.test.ts

- It should:
  - Create a product. Use the function `createProduct` for this.
    - It should like to an academy course that you created using the fake academy integration service.

  - Create a sales event that references this product. Use `createSalesEvent` in domain/sales-event/model.ts for this.
    - It should link to a smoove list id
      that you created using the fake smoove integration service..

  - Simulate a cardcom webhook call similar to the one found in test/manual/cardcom-sale-simulation.ts
    - Try and make this test and the code in test/manual/cardcom-sale-simulation.ts use the same function to generate
      the cardcom JSON body and call the API. This function should be in a file in test/common.

  - Check the following things

    - A student was created with the correct name, email, and phone. You can check this by going to the student list

    - A sale was created with the correct information

    - A smoove contact was create and the correct linked list was assigned to it

    - The user was added to the correct academy course.

## General instructions

- Absolutely no comments!

- In the tests always use the page model pattern you can see in the other tests. If there is something that isn't
  there, create it.

- When you run the test and it fails, assume the problem is in the test and not in the prodcution code itself.
  - If you still believe the problem is in the production code, ask permission before changing it and explain why
