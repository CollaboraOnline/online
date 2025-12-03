Note: Always test in nextcloud env. as it may have extra features/options to test

1. If we use heading structure then it should follow hierarchy in dialog: H1 -> H2 -> H3 -> H4 -> H5 -> H6 (Do not jump from H2 -> H4).
2. Always provide meaningful title. A clear title announced by assistive technology helps user understand it a lot better
3. Use relevant elements not just `<div>`. i.e. for navigator use `<nav>` instead of `<div>`, Prefer `<h1>` over `<div>` with updated the css to look like heading
4. For button image - exactly one accessible name source should define meaning: either aria-label on button OR alt on img, not both.
5. Always provide alt attribute for image. if parent has aria-label, we can not omit alt attribute on img, instead we should add empty alt attribute.
6. Never use `tabindex="0"` on large containers. Only interactive items should be focusable.

   1. **Focusable elements:**
      1. `"<button>"`
      2. `"<input> (all types)"`
      3. `"<select>"`
      4. `"<textarea>"`
      5. `"<a href=\"\">"`
      6. `"<details> (summary element is focusable)"`
      7. `"<summary>"`
      8. `"<iframe>"`
      9. `"<audio controls> / <video controls>"`

   2. **Non-focusable elements:**
      1. `"<div>"`
      2. `"<span>"`
      3. `"<img>"`
      4. `"<p>"`
      5. `"<label>"`


7. `aria-label` should be used on the elements that can be focused - i.e. if a button is wrapped inside a div then the aria-label should be on the focusable/button element
9. Try to use the existing native elements first. i.e. I noticed an instance where we had checkbox but we were make it transparent and apply the checkbox svg on top of it deptecting the correct state. It will work as expected. you will find nothing wrong until you try to use keyboard to access it and found that it is not focusable. absolutely we can fix it with this structure also but why to introduce complex solution when we achieve the same thing with simpler and more reliable native elements. So, always try to use the native element. it will help us ease the usability as well as accessibility.
9. Rules of thumb
```
1. If the UI can have visible text → use a <label>
	WCAG encourages visible labels because they help everyone, not just screen reader users.

2. If visible text exists somewhere else → use aria-labelledby
	E.g., a heading above a form control.

3. If no visible text is possible → use aria-label

4. Custom ARIA widgets always require an accessible name
	1. Role = button, checkbox, combobox, switch, menuitem
	2. Form input elements
	3. Buttons and links sometimes
	4. Icon only interactive elements

Priority order:
1. label's for attribute (only for form input elements)
2. aria-labelledby
3. aria-label

Note: in above priority, specifically for first two items(referenced using either label's for attribute or element's aria-labelledby attribute) relevant element must exist in DOM.
```
10. We have many controllers which are parsing the json coming from core. Now, for those controllers if there is only either aria-label or aria-labelledby logic then we should have both logic instead of just one of them to cover all possible cases and make sure no cases are left for which we do not have correct aria attribute and also if not sure see the relevant UI file from core to find out how they have implemented this. they will have mostly connected using this 3 cases.
	1. Connected to visible label via mnemonic_widget => most likely already referenced correctly
	2. Connected via label-for and labelled-by attribute => add relevant parsing logic in online side if not exist already
	3. Only have accessible-description => we should add new accessible-name here to produce the aria-label in json and parse it in online.
11. If a label is not referencing to any element then in online side it shoud not parse it as `<label>` instead it should be `<span>`. this can be easily achievable by adding below static role to label.
	1. ```
	   <child internal-child="accessible">
          <object class="AtkObject" id="<GtkLabel-id>-atkobject">
             <property name="AtkObject::accessible-role">static</property>
          </object>
       </child>
	   ```
12. When implement a new control - please check if it has aria attribute in json? if yes, try to use it in control logic to make that element capture by assistive technology
13. Each input field/form field should have either visible label, aria-labelledby or aria-label to make it accessible
14. If a input field have visible label then make sure that both are programmatically connected using either for attriubte of label or aria-labelledby attribute in input element
15. We should put more attention on when to use which role. please see below Accessibility Role Guideline:

| **Role Name**                 | **Description**                                                         | **Criteria to Use (BITV/WCAG)**                                                                                                                                                                                                                                 | **Required / Expected Children**                | **Relevant ARIA Attributes**                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **`radiogroup`**              | A group of mutually exclusive options. User can select **exactly one**. | ✔ When the widget represents a **mode selector** or **single-choice option set**.<br>✔ Only one can ever be selected.                              | `radio` items                                   | On children (`role="radio"`):<br>• `aria-checked` (required)<br>On parent:<br>• `aria-label` or `aria-labelledby` <br>see: [Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)                              |
| **`listbox` (single-select)** | A scrollable or long list of items. User selects **one** item.          | ✔ When the list is **long**.<br>✔ When items scroll or are too many for radios.<br>✔ When items represent data, not modes.<br>**x** Not for mutually exclusive UI modes (radiogroup preferred). | `option` items                                  | Parent:<br>• `aria-activedescendant` (common)<br>Children (`role="option"`):<br>• `aria-selected` (required) <br>see: [Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)                                   |
| **`listbox` (multi-select)**  | A list allowing **multiple selections**.                                | ✔ When more than one item may be selected.<br>✔ When using Ctrl/Shift multi-selection.<br>✔ For selecting sets of elements, files, shapes, etc.<br>**x** Not for mutually exclusive modes.                                                                          | `option` items                                  | Parent:<br>• `aria-multiselectable="true"`<br>• `aria-activedescendant` (common)<br>Children:<br>• `aria-selected` (required) <br>see: [Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)                  |
| **`grid`**                    | An interactive table-like component with row/column navigation.         | ✔ When the widget behaves like a **2D grid**.<br>✔ Arrow keys move in four directions.<br>✔ Items act like cells (spreadsheet, matrix, thumbnails with coordinates).<br>          | `row` → `gridcell`                              | Parent:<br>• `aria-rowcount`, `aria-colcount` (recommended)<br>Children:<br>• `aria-selected` (optional)<br>• `aria-colindex`, `aria-rowindex` <br>see: [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) |
| **`tree`**                    | A hierarchical expandable/collapsible list.                             | ✔ Only when entries are **nested**, expandable, collapsible.<br>✔ File-explorer-style lists.<br>**x** Not for simple icon sets.                                                                                                                                     | `treeitem` (optionally inside `group`)          | Children:<br>• `aria-expanded`<br>• `aria-selected` <br>see: [Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)                                                                                            |
| **`treegrid`**                | Hybrid of tree + grid. Hierarchical with multiple columns.              | ✔ For complex structures mixing **hierarchy** + **cells**.<br>✔ Very rare.<br>                                                                                                                                                  | `row` → `gridcell` + hierarchy                  | Similar to grid + tree attributes <br>see: [Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)                                                                                                              |
| **`menu`**                    | Application-style menu (vertical).                                      | ✔ Only when replicating desktop app menus.<br>✔ File / Edit / View structures.<br>x Not for selection lists.                                                                                                                                                    | `menuitem`, `menuitemcheckbox`, `menuitemradio` | Depending on children:<br>• `aria-checked` for menuitemcheckbox/menuitemradio <br>see: [Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)                                                                   |
| **`menubar`**                 | Horizontal menu bar.                                                    | ✔ Only for actual menu bars.<br>**x** Not for icon pickers.                                                                                                                                                                                                         | same as `menu`                                  | same as `menu` <br>see: [Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)                                                                   |                                                                                                                                 |
| **`combobox`**                | Editable input with dropdown listbox.                                   | ✔ For dropdown that expands into listbox.<br>**x** Not for an icon grid.                                                                                                                                                                                            | Must contain or reference a `listbox`           | Many mandatory: `aria-expanded`, `aria-controls`, `aria-haspopup`, `aria-activedescendant` <br>see: [Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)                                                     |
| **`tabs`**                 | A set of tabs that switch views.                                        | ✔ Only for page/section switching.<br>**x** Not for selection lists.                                                                                                                                                                                                | `tab` items connected to `tabpanel`             | Children:<br>• `aria-selected`<br>Parent:<br>• `aria-orientation` <br>see: [Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)                                                                              |

**Guide for more patterns:** https://www.w3.org/WAI/ARIA/apg/patterns/

16. For semantic group always use `<fieldset>/<legend>` instead of `<label>`
17. Use different name attribute for different input radio elements as the focus management is automatically handled by browser here and having same name for different types of input radio button can cause navigation issue. i.e.. in Font color dropdown the color palatte, custom color, and recent colors input radio button were using the same name="color" which was causing the navigation issue for custom and recent colors.
18. For a group of radio inputs always use radiogroup on parent for grouping
19. For ARIA attributes i.e aria-expanded - always update its value to reveal current status
20. We really should have unique id for across all elements - otherwise it affects accessibility
21. Please choose the colors that follows non-text contrast color guideline
	1. Borders and the backgrounds of the input fields should have contrast ratio of > 3:1
	2. Text and its background contrast ratio should be > 4.5:1
	3. Website to see if your colors pass guideline:
		1. https://webaim.org/resources/contrastchecker/
		2. https://accessibleweb.com/color-contrast-checker/
	4. More info: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
22. Decorative elements should not be focusable, only interactive elements should have focus
23. Target minimum size: 24x24 rule
	1. see: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
24. For a tab interface always use tab and tabpanel roles with appropriate ARIA attributes
