import {useCallback, useRef, useState, type ReactElement, type ReactNode} from 'react'
import type {Editor, JSONContent} from '@tiptap/core'
import {useEditorState} from '@tiptap/react'
import * as Toolbar from '@radix-ui/react-toolbar'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  DotsHorizontalIcon,
  FontBoldIcon,
  FontItalicIcon,
  ImageIcon,
  Link2Icon,
  ListBulletIcon,
  PlusIcon,
  ResetIcon,
  StrikethroughIcon,
  TableIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  UnderlineIcon,
} from '@radix-ui/react-icons'
import {SlashCommand, useEditorFocusScope} from '@react-email/editor/ui'
import type {Labels} from '../labels.ts'
import {isTemplateUrl} from '../urls.ts'

export function setDirection(editor: Editor, direction: 'rtl' | 'ltr'): void {
  const {$from} = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (!node.isTextblock) continue
    const style = document.createElement('span').style
    style.cssText = node.attrs.style ?? ''
    style.direction = direction
    editor.chain().focus().updateAttributes(node.type.name, {style: style.cssText}).run()
    return
  }
}

function tableAction(
  editor: Editor,
  action: 'addRow' | 'addColumn' | 'deleteRow' | 'deleteColumn',
): void {
  const {$from} = editor.state.selection
  let depth = $from.depth
  while (depth > 0 && $from.node(depth).type.name !== 'table') depth--
  if (!depth) return
  const table = $from.node(depth)
  const rowIndex = $from.index(depth)
  const columnIndex = $from.index(depth + 1)
  const rows = table.toJSON().content as JSONContent[]
  const cell: JSONContent = {type: 'tableCell', content: [{type: 'paragraph'}]}
  if (action === 'addRow')
    rows.splice(rowIndex + 1, 0, {
      type: 'tableRow',
      content: rows[rowIndex].content!.map(() => structuredClone(cell)),
    })
  if (action === 'deleteRow') rows.splice(rowIndex, 1)
  if (action === 'addColumn')
    rows.forEach((row) => row.content!.splice(columnIndex + 1, 0, structuredClone(cell)))
  if (action === 'deleteColumn') rows.forEach((row) => row.content!.splice(columnIndex, 1))
  const from = $from.before(depth)
  editor
    .chain()
    .focus()
    .insertContentAt(
      {from, to: from + table.nodeSize},
      rows.length && rows[0].content!.length
        ? {...table.toJSON(), content: rows}
        : {type: 'paragraph'},
    )
    .run()
}

export function EditorControls({
  editor,
  t,
  onError,
  disabled,
}: {
  editor: Editor
  t: Labels
  onError: (message: string) => void
  disabled: boolean
}): ReactElement {
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [expression, setExpression] = useState('')
  const [openPopover, setOpenPopover] = useState<string | undefined>(undefined)
  const returnToEditor = useRef(false)
  const {registerScope, unregisterScope} = useEditorFocusScope()
  const editorFocusRef = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return
      registerScope(element)
      return () => unregisterScope(element)
    },
    [registerScope, unregisterScope],
  )
  const direction = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'
  const state = useEditorState({
    editor,
    selector: ({editor}) => ({
      marks: ['bold', 'italic', 'underline', 'strike', 'code', 'sup', 'uppercase'].filter((mark) =>
        editor.isActive(mark),
      ),
      heading: editor.isActive('heading') ? Number(editor.getAttributes('heading').level) : 0,
      paragraph: editor.isActive('paragraph'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      table: editor.isActive('table'),
      undo: editor.can().undo(),
      redo: editor.can().redo(),
    }),
  })
  const textStyles = [
    {title: t.paragraph, run: () => editor.chain().focus().setParagraph().run()},
    ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
      title: `${t.heading} ${level}`,
      run: () => editor.chain().focus().setHeading({level}).run(),
    })),
  ]
  const lists = [
    {title: t.bulletList, run: () => editor.chain().focus().toggleBulletList().run()},
    {title: t.orderedList, run: () => editor.chain().focus().toggleOrderedList().run()},
  ]
  const blocks = [
    {title: t.blockquote, run: () => editor.chain().focus().toggleBlockquote().run()},
    {title: t.codeBlock, run: () => editor.chain().focus().toggleCodeBlock().run()},
    {title: t.horizontalRule, run: () => editor.chain().focus().setHorizontalRule().run()},
    {title: t.section, run: () => editor.chain().focus().insertSection().run()},
    ...([2, 3, 4] as const).map((count) => ({
      title: `${count} ${t.columns}`,
      run: () => editor.chain().focus().insertColumns(count).run(),
    })),
    {
      title: t.button,
      run: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'button',
            attrs: {href: '#'},
            content: [{type: 'text', text: t.button}],
          })
          .run(),
    },
    {
      title: t.table,
      run: () =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'table',
            content: Array.from({length: 2}, () => ({
              type: 'tableRow',
              content: Array.from({length: 2}, () => ({
                type: 'tableCell',
                content: [{type: 'paragraph'}],
              })),
            })),
          })
          .run(),
    },
  ]
  const commands = [...textStyles, ...lists, ...blocks]

  function runFromOverlay(run: () => unknown): void {
    returnToEditor.current = true
    run()
  }
  function closeAutoFocus(event: Event): void {
    if (!returnToEditor.current) return
    event.preventDefault()
    returnToEditor.current = false
    editor.commands.focus()
  }
  const button = (
    label: string,
    icon: ReactNode,
    run: () => unknown,
    pressed: boolean | undefined,
    unavailable: boolean,
  ) => (
    <Toolbar.Button
      key={label}
      type="button"
      className="template-tool"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled || unavailable}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}>
      {icon}
    </Toolbar.Button>
  )
  const menuItem = (label: string, run: () => unknown, unavailable: boolean) => (
    <DropdownMenu.Item
      key={label}
      className="template-menu-item"
      disabled={disabled || unavailable}
      onSelect={() => runFromOverlay(run)}>
      {label}
    </DropdownMenu.Item>
  )
  const menu = (label: string, trigger: ReactNode, children: ReactNode) => (
    <DropdownMenu.Root dir={direction} modal={false}>
      <Toolbar.Button asChild>
        <DropdownMenu.Trigger
          className="template-tool"
          aria-label={label}
          title={label}
          disabled={disabled}>
          {trigger}
          <ChevronDownIcon aria-hidden="true" />
        </DropdownMenu.Trigger>
      </Toolbar.Button>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          ref={editorFocusRef}
          className="template-menu"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={closeAutoFocus}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
  const popover = (label: string, icon: ReactNode, children: ReactNode) => (
    <Popover.Root
      open={openPopover === label}
      onOpenChange={(open) => {
        if (open && label === t.linkMenu) {
          const href = editor.getAttributes(editor.isActive('button') ? 'button' : 'link').href
          setLinkUrl(typeof href === 'string' ? href : '')
        }
        setOpenPopover(open ? label : undefined)
      }}>
      <Toolbar.Button asChild>
        <Popover.Trigger
          className="template-tool"
          aria-label={label}
          title={label}
          disabled={disabled}>
          {icon}
        </Popover.Trigger>
      </Toolbar.Button>
      <Popover.Portal>
        <Popover.Content
          ref={editorFocusRef}
          className="template-popover"
          aria-label={label}
          dir={direction}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={closeAutoFocus}>
          <fieldset disabled={disabled}>{children}</fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
  return (
    <>
      <Toolbar.Root
        ref={editorFocusRef}
        className="template-toolbar"
        aria-label={t.html}
        dir={direction}>
        <div className="template-tool-group">
          {button(
            t.undo,
            <ResetIcon aria-hidden="true" />,
            () => editor.chain().focus().undo().run(),
            undefined,
            !state.undo,
          )}
          {button(
            t.redo,
            <ResetIcon className="template-redo" aria-hidden="true" />,
            () => editor.chain().focus().redo().run(),
            undefined,
            !state.redo,
          )}
        </div>
        <div className="template-tool-group">
          {menu(
            t.textStyle,
            <span className="template-text-style">
              {state.heading
                ? `${t.heading} ${state.heading}`
                : state.paragraph
                  ? t.paragraph
                  : t.textStyle}
            </span>,
            textStyles.map(({title, run}) => menuItem(title, run, false)),
          )}
        </div>
        <div className="template-tool-group">
          {(
            [
              ['bold', FontBoldIcon],
              ['italic', FontItalicIcon],
              ['underline', UnderlineIcon],
              ['strike', StrikethroughIcon],
            ] as const
          ).map(([mark, Icon]) =>
            button(
              t[mark],
              <Icon aria-hidden="true" />,
              () => editor.chain().focus().toggleMark(mark).run(),
              state.marks.includes(mark),
              false,
            ),
          )}
          {menu(
            t.moreFormatting,
            <DotsHorizontalIcon aria-hidden="true" />,
            (['code', 'sup', 'uppercase'] as const).map((mark) => (
              <DropdownMenu.CheckboxItem
                key={mark}
                className="template-menu-item"
                checked={state.marks.includes(mark)}
                disabled={disabled}
                onSelect={() =>
                  runFromOverlay(() => editor.chain().focus().toggleMark(mark).run())
                }>
                <span className="template-menu-check">
                  <DropdownMenu.ItemIndicator>
                    <CheckIcon aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {t[mark]}
              </DropdownMenu.CheckboxItem>
            )),
          )}
        </div>
        <div className="template-tool-group">
          {button(
            t.bulletList,
            <ListBulletIcon aria-hidden="true" />,
            lists[0].run,
            state.bulletList,
            false,
          )}
          {button(
            t.orderedList,
            <span aria-hidden="true" className="template-numbered-list">
              1.
            </span>,
            lists[1].run,
            state.orderedList,
            false,
          )}
          {menu(
            t.alignment,
            <TextAlignLeftIcon aria-hidden="true" />,
            (
              [
                [t.alignLeft, 'left', TextAlignLeftIcon],
                [t.alignCenter, 'center', TextAlignCenterIcon],
                [t.alignRight, 'right', TextAlignRightIcon],
              ] as const
            ).map(([label, align, Icon]) => (
              <DropdownMenu.Item
                key={align}
                className="template-menu-item"
                disabled={disabled}
                onSelect={() =>
                  runFromOverlay(() => editor.chain().focus().setAlignment(align).run())
                }>
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenu.Item>
            )),
          )}
          {button(
            t.ltr,
            <ArrowRightIcon aria-hidden="true" />,
            () => setDirection(editor, 'ltr'),
            undefined,
            false,
          )}
          {button(
            t.rtl,
            <ArrowLeftIcon aria-hidden="true" />,
            () => setDirection(editor, 'rtl'),
            undefined,
            false,
          )}
        </div>
        <div className="template-tool-group">
          {popover(
            t.linkMenu,
            <Link2Icon aria-hidden="true" />,
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!isTemplateUrl(linkUrl, false)) {
                  onError(t.unsafeHtml)
                  return
                }
                runFromOverlay(() => {
                  if (editor.isActive('button'))
                    editor.chain().focus().updateButton({href: linkUrl}).run()
                  else editor.chain().focus().extendMarkRange('link').setLink({href: linkUrl}).run()
                })
                setOpenPopover(undefined)
              }}>
              <label>
                {t.url}
                <input
                  className="form-control form-control-sm"
                  dir="ltr"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
              </label>
              <div className="d-flex gap-2">
                <button className="btn btn-primary btn-sm">{t.link}</button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    runFromOverlay(() =>
                      editor.chain().focus().extendMarkRange('link').unsetLink().run(),
                    )
                    setOpenPopover(undefined)
                  }}>
                  {t.unlink}
                </button>
              </div>
            </form>,
          )}
          {popover(
            t.image,
            <ImageIcon aria-hidden="true" />,
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!imageUrl.trim() || !isTemplateUrl(imageUrl, true)) {
                  onError(t.unsafeHtml)
                  return
                }
                runFromOverlay(() =>
                  editor
                    .chain()
                    .focus()
                    .insertContent({type: 'image', attrs: {src: imageUrl, alt}})
                    .run(),
                )
                setOpenPopover(undefined)
              }}>
              <label>
                {t.url}
                <input
                  className="form-control form-control-sm"
                  dir="ltr"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                />
              </label>
              <label>
                {t.alt}
                <input
                  className="form-control form-control-sm"
                  value={alt}
                  onChange={(event) => setAlt(event.target.value)}
                />
              </label>
              <button className="btn btn-primary btn-sm">{t.insertImage}</button>
            </form>,
          )}
          {popover(
            t.expression,
            <CodeIcon aria-hidden="true" />,
            <form
              onSubmit={(event) => {
                event.preventDefault()
                runFromOverlay(() => {
                  if (/^\s*\{\{[#/!^]|^\s*\{\{\s*else\b/.test(expression)) {
                    editor
                      .chain()
                      .focus()
                      .insertContent({type: 'templateDirective', attrs: {expression}})
                      .run()
                  } else {
                    editor.chain().focus().insertContent({type: 'text', text: expression}).run()
                  }
                })
                setOpenPopover(undefined)
              }}>
              <label>
                {t.expression}
                <input
                  className="form-control form-control-sm"
                  dir="ltr"
                  value={expression}
                  onChange={(event) => setExpression(event.target.value)}
                />
              </label>
              <p className="small text-body-secondary">{t.expressionHelp}</p>
              <button className="btn btn-primary btn-sm">{t.insertExpression}</button>
            </form>,
          )}
          {menu(
            t.insert,
            <>
              <PlusIcon aria-hidden="true" />
              <span>{t.insert}</span>
            </>,
            blocks.map(({title, run}) => menuItem(title, run, false)),
          )}
          {menu(
            t.tableActions,
            <TableIcon aria-hidden="true" />,
            <>
              {(['addRow', 'addColumn', 'deleteRow', 'deleteColumn'] as const).map((key) =>
                menuItem(t[key], () => tableAction(editor, key), !state.table),
              )}
              <DropdownMenu.Separator className="template-menu-separator" />
              {menuItem(t.deleteBlock, () => editor.chain().focus().deleteSelection().run(), false)}
            </>,
          )}
        </div>
      </Toolbar.Root>
      <SlashCommand
        items={commands.map(({title, run}) => ({
          title,
          description: title,
          category: t.html,
          icon: null,
          command: ({editor, range}) => {
            editor.chain().focus().deleteRange(range).run()
            run()
          },
        }))}>
        {({items, selectedIndex, onSelect}) => (
          <div className="template-commands">
            {items.map((item, index) => (
              <button
                type="button"
                key={item.title}
                aria-selected={index === selectedIndex}
                onClick={() => onSelect(index)}>
                {item.title}
              </button>
            ))}
          </div>
        )}
      </SlashCommand>
    </>
  )
}
