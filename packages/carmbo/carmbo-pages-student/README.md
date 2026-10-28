# `@giltayar/carmbo-pages-student`

Student pages and student domain operations for Carmbo applications.

## Shared student picker

Other page packages can use the student search/create dialog without implementing student endpoints:

```ts
import {
  StudentPickerButton,
  StudentPickerDialogContainer,
} from '@giltayar/carmbo-pages-student/student-picker'

html`
  <form>
    <label for="student-number">Student</label>
    <input id="student-number" name="studentNumber" />
    <${StudentPickerButton} targetFieldId="student-number" />
  </form>
  <${StudentPickerDialogContainer} targetFieldId="student-number" />
`
```

Mount this package's student routes in the host, using the existing route options and integrations.
The host must load Bootstrap and HTMX, register the form-body parser, and initialize the Carmbo
commons layout/localization services as it does for other student pages. The picker supplies its own
dialog stylesheet and English/Hebrew labels.

Both components accept `basePath` (default `/students`); set it to the student routes' actual mount
prefix when mounting elsewhere. `targetFieldId` must match an existing editable input and contain
only ASCII letters, digits, underscores, or hyphens, beginning with a letter. Use unique target IDs
for multiple pickers. Place each dialog container **outside every form**, since the dialog contains
its own search/create forms.

Selecting a student updates the existing input to `number: Name`, preserving its listeners and
attributes, then dispatches a bubbling `change` event. Its `CustomEvent<StudentPickerSelection>`
detail contains `studentNumber`, `name`, `email`, and `phone` (the primary contact details). Consumers
can use that detail to update related fields. The dialog closes and focuses the selected input.
Cancel/Escape leave the consumer's form unchanged.

Search returns up to 20 active students. Quick creation uses the same validation, normalization,
history, and configured mailing integrations as ordinary student creation. Errors remain in the
dialog with entered values preserved. Creating a student is independent of submitting the consuming
form: cancelling that form afterward does not remove the newly created student.

The mounted routes include `/picker`, `/picker/search`, `/picker/select`, `/picker/create`, and
`/picker.css`. The host's authorization must protect these routes just like the other student routes.
The public entry also exports `StudentPickerOptions` and `StudentPickerSelection` types. Browser
tests can reuse `createStudentPickerPageModel` from
`@giltayar/carmbo-pages-student/testkit/page-model/student-picker.model` for the English dialog.

## Local start

Start the package's PostgreSQL service and local Fastify host:

```bash
pnpm start
```

Open <http://127.0.0.1:3000/students>. Data persists until the Docker Compose service is removed.
The start lifecycle refreshes Bootstrap and HTMX assets under `start/dist` before serving them.

Stop and remove the local PostgreSQL service:

```bash
pnpm stop
```

Use `LANGUAGE=he pnpm start` for Hebrew/Liraz rendering. The Fastify and PostgreSQL ports are fixed
at `3000` and `5433`, respectively.
