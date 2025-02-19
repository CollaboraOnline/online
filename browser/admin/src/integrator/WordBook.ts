/* eslint-disable */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

interface WordbookFile {
	headerType: string; // eg. "OOoUserDict1"
	language: string; // the value after "lang:" (eg. "<none>")
	dictType: string; // the value after "type:" (eg. "positive")
	words: string[]; // list of dictionary words
}

class WordBook {
	private loadingModal: HTMLDivElement | null = null;

	startLoader() {
		this.loadingModal = document.createElement('div');
		this.loadingModal.className = 'modal';
		const loadingContent = document.createElement('div');
		loadingContent.className = 'modal-content';
		loadingContent.textContent = 'Loading Wordbook...';
		this.loadingModal.appendChild(loadingContent);
		document.body.appendChild(this.loadingModal);
	}

	stopLoader() {
		if (this.loadingModal) {
			document.body.removeChild(this.loadingModal);
			this.loadingModal = null;
		}
	}

	openWordbookEditor(fileName: string, wordbook: WordbookFile): void {
		const modal = document.createElement('div');
		modal.className = 'modal';

		const modalContent = document.createElement('div');
		modalContent.className = 'modal-content';

		const titleEl = document.createElement('h2');
		titleEl.textContent = `${fileName} (Edit)`;
		titleEl.style.textAlign = 'center';
		modalContent.appendChild(titleEl);

		const inputContainer = document.createElement('div');
		inputContainer.className = 'dic-input-container';
		inputContainer.style.margin = '16px 0';

		const newWordInput = document.createElement('input');
		newWordInput.type = 'text';
		newWordInput.placeholder = 'Enter new word';
		newWordInput.className = 'input-field__input';
		inputContainer.appendChild(newWordInput);

		const addButton = document.createElement('button');
		addButton.textContent = 'Add';
		addButton.className = 'button button--vue-secondary';
		addButton.style.marginLeft = '8px';
		addButton.addEventListener('click', () => {
			const newWord = newWordInput.value.trim();
			if (newWord) {
				wordbook.words.push(newWord);
				this.updateWordList(wordList, wordbook);
				newWordInput.value = '';
			}
		});
		inputContainer.appendChild(addButton);

		modalContent.appendChild(inputContainer);

		const wordList = document.createElement('ul');
		wordList.id = 'dicWordList';
		this.updateWordList(wordList, wordbook);
		modalContent.appendChild(wordList);

		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'dic-button-container';
		buttonContainer.style.textAlign = 'center';
		buttonContainer.style.marginTop = '24px';

		const cancelButton = document.createElement('button');
		cancelButton.textContent = 'Cancel';
		cancelButton.className = 'button button--vue-tertiary';
		cancelButton.style.marginRight = '12px';
		cancelButton.addEventListener('click', () => {
			document.body.removeChild(modal);
		});
		buttonContainer.appendChild(cancelButton);

		const submitButton = document.createElement('button');
		submitButton.textContent = 'Submit';
		submitButton.className = 'button button--vue-primary';
		submitButton.addEventListener('click', async () => {
			console.debug('wordbook', wordbook);
			const updatedContent = this.buildWordbookFile(wordbook);
			console.debug('Updated Dictionary Content:\n', updatedContent);
			await (window as any).settingIframe.uploadWordbookFile(
				fileName,
				updatedContent,
			);
			document.body.removeChild(modal);
		});

		buttonContainer.appendChild(submitButton);

		modalContent.appendChild(buttonContainer);
		modal.appendChild(modalContent);
		document.body.appendChild(modal);
	}

	parseWordbookFileAsync(content: string): Promise<WordbookFile> {
		return new Promise((resolve, reject) => {
			const workerCode = `
				self.onmessage = function(e) {
					const content = e.data;
					const lines = content.split(/\\r?\\n/).filter(line => line.trim() !== '');
					const delimiterIndex = lines.findIndex(line => line.trim() === '---');
					if (delimiterIndex === -1) {
						self.postMessage({ error: "Invalid dictionary format: missing delimiter '---'" });
						return;
					}
					if (delimiterIndex < 3) {
						self.postMessage({ error: "Invalid dictionary format: not enough header lines before delimiter" });
						return;
					}
					const headerType = lines[0].trim();
					const languageMatch = lines[1].trim().match(/^lang:\\s*(.*)$/i);
					const language = languageMatch ? languageMatch[1].trim() : '';
					const typeMatch = lines[2].trim().match(/^type:\\s*(.*)$/i);
					const dictType = typeMatch ? typeMatch[1].trim() : '';
					const words = lines.slice(delimiterIndex + 1).filter(line => line.trim() !== '');
					self.postMessage({ result: { headerType, language, dictType, words } });
				};
			`;
			const blob = new Blob([workerCode], { type: 'application/javascript' });
			const worker = new Worker(URL.createObjectURL(blob));

			worker.onmessage = function (e) {
				if (e.data.error) {
					reject(new Error(e.data.error));
				} else {
					resolve(e.data.result);
				}
				worker.terminate();
			};
			worker.onerror = function (e) {
				reject(e);
				worker.terminate();
			};

			worker.postMessage(content);
		});
	}

	parseWordbookFile(content: string): WordbookFile {
		const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
		const delimiterIndex = lines.findIndex((line) => line.trim() === '---');
		if (delimiterIndex === -1) {
			window.alert('Invalid dictionary format');
			throw new Error('Invalid dictionary format: missing delimiter "---"');
		}
		if (delimiterIndex < 3) {
			window.alert('Invalid dictionary format');
			throw new Error(
				'Invalid dictionary format: not enough header lines before delimiter',
			);
		}

		const headerType = lines[0].trim();

		const languageMatch = lines[1].trim().match(/^lang:\s*(.*)$/i);
		const language = languageMatch ? languageMatch[1].trim() : '';

		const typeMatch = lines[2].trim().match(/^type:\s*(.*)$/i);
		const dictType = typeMatch ? typeMatch[1].trim() : '';

		const words = lines
			.slice(delimiterIndex + 1)
			.filter((line) => line.trim() !== '');

		return { headerType, language, dictType, words };
	}

	async wordbookValidation(uploadPath: string, file: File) {
		try {
			const content = await this.readFileAsText(file);
			let dicWords: string[];
			try {
				dicWords = this.parseWords(content);
			} catch (error) {
				window.alert('Invalid dictionary format. Please check the file.');
				console.error('Error parsing dictionary file:', error);
				return;
			}
			// TODO: Assuming default values - should be dynamic later?
			const defaultHeaderType = 'OOoUserDict1';
			const defaultLanguage = '<none>';
			const defaultDictType = 'positive';
			const newDic: WordbookFile = {
				headerType: defaultHeaderType,
				language: defaultLanguage,
				dictType: defaultDictType,
				words: dicWords,
			};
			const newContent = this.buildWordbookFile(newDic);
			await (window as any).settingIframe.uploadWordbookFile(
				file.name,
				newContent,
			);
		} catch (error) {
			window.alert('Something went wrong while uploading dictionary file');
		}
	}

	private buildWordbookFile(wordbook: WordbookFile): string {
		const header = [
			wordbook.headerType.trim(),
			`lang: ${wordbook.language}`,
			`type: ${wordbook.dictType}`,
		];
		return [...header, '---', ...wordbook.words].join('\n');
	}

	private updateWordList(listEl: HTMLElement, wordbook: WordbookFile): void {
		listEl.innerHTML = '';
		wordbook.words.forEach((word, index) => {
			// TODO IDEA: Extract list as components?

			const li = document.createElement('li');
			li.classList.add('list-item__wrapper');

			const listItemDiv = document.createElement('div');
			listItemDiv.classList.add('list-item');

			const wordContainer = document.createElement('div');
			wordContainer.classList.add('list-item__anchor');

			const wordContentDiv = document.createElement('div');
			wordContentDiv.classList.add('list-item-content');

			const wordTextDiv = document.createElement('div');
			wordTextDiv.classList.add('list-item-content__main');
			const wordNameDiv = document.createElement('div');
			wordNameDiv.classList.add('list-item-content__name');
			wordNameDiv.textContent = word;

			wordTextDiv.appendChild(wordNameDiv);
			wordContentDiv.appendChild(wordTextDiv);
			wordContainer.appendChild(wordContentDiv);

			listItemDiv.appendChild(wordContainer);

			const delButton = document.createElement('button');
			delButton.type = 'button';
			delButton.classList.add(
				'button',
				'button--size-normal',
				'button--icon-only',
				'button--vue-secondary',
				'delete-icon',
			);
			delButton.innerHTML = `
            <span class="button__wrapper">
              <span aria-hidden="true" class="button__icon">
                <span aria-hidden="true" role="img" class="material-design-icon">
                  <svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19
                              A2,2 0 0,0 8,21H16
                              A2,2 0 0,0 18,19V7H6V19Z"></path>
                  </svg>
                </span>
              </span>
            </span>
          `;
			delButton.addEventListener('click', () => {
				wordbook.words.splice(index, 1);
				this.updateWordList(listEl, wordbook);
			});
			listItemDiv.appendChild(delButton);

			li.appendChild(listItemDiv);
			listEl.appendChild(li);
		});
	}

	private async readFileAsText(file: File): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsText(file);
		});
	}

	private parseWords(content: string): string[] {
		const lines = content
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line !== '');
		const delimiterIndex = lines.findIndex((line) => line === '---');
		if (delimiterIndex !== -1) {
			return lines.slice(delimiterIndex + 1);
		}
		return lines;
	}
}

(window as any).WordBook = new WordBook();
