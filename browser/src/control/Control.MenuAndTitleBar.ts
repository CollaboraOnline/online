namespace Control {
    class MenuAndTitleBar {
        private mainNav = document.querySelector('.main-nav') as HTMLElement;

        private excludedClasses = [
            'ui-tab',
            'ui-expander',
            'ui-corner-all',
            'button-primary',
            'unobutton',
            'form-field-button',
            'col',
            'arrowbackground',
        ];

        public init(): void {
            if (!this.mainNav) return;

            this.applyMainNavStyles();
            this.styleSecondaryButtons();
            this.applyResponsiveRules();
            this.observeResize();
            this.applyExtraStyles();
            this.applyAdditionalLayoutStyles();


        }

        private applyMainNavStyles(): void {
            const mainNav = this.mainNav as HTMLElement;

            // Base main-nav styles
            mainNav.style.boxSizing = 'border-box';
            mainNav.style.height = 'var(--header-height)';
            mainNav.style.width = '100%';
            mainNav.style.background = 'var(--color-background-lighter)';
            mainNav.style.padding = '3px 3px 3px 0';
            mainNav.style.whiteSpace = 'nowrap';
            mainNav.style.zIndex = '12';
            mainNav.style.display = 'flex';
            mainNav.style.alignItems = 'center';

            // Readonly mode adjustments
            if (mainNav.classList.contains('readonly')) {
                mainNav.style.position = 'relative';
                mainNav.style.borderBottom = '1px solid var(--color-border)';

                const optionsToolbox = document.querySelector('#optionstoolboxdown') as HTMLElement;
                if (optionsToolbox) optionsToolbox.style.display = 'none';

                const documentHeader = document.querySelector('#main-menu #document-header') as HTMLElement;
                if (documentHeader && mainNav.classList.contains('hasnotebookbar')) {
                    documentHeader.style.display = 'none';
                }
            }

            // hasnotebookbar styles
            if (mainNav.classList.contains('hasnotebookbar')) {
                mainNav.style.setProperty('scrollbar-width', 'none');
                mainNav.style.setProperty('-ms-scrollbar', 'none');

                const scrollStyles = (mainNav.style as any);
                if (scrollStyles && scrollStyles.setProperty) {
                    scrollStyles.setProperty('--webkit-scrollbar', '0');
                }

                if (!mainNav.classList.contains('readonly')) {
                    mainNav.style.background = 'var(--color-main-background)';
                    mainNav.style.padding = '0px 0px 0px 5px';
                    mainNav.style.overflow = 'scroll hidden';

                    const documentTitlebar = document.querySelector('#document-titlebar') as HTMLElement;
                    if (documentTitlebar) {
                        documentTitlebar.style.display = 'flex';
                        documentTitlebar.style.alignSelf = 'center';
                    }
                }
            }

            // Clearfix simulation
            const clearfix = document.createElement('div');
            clearfix.style.clear = 'both';
            clearfix.style.content = "'\\00a0'";
            clearfix.style.display = 'block';
            clearfix.style.height = '0';
            clearfix.style.font = '0px/0 serif';
            clearfix.style.overflow = 'hidden';
            mainNav.appendChild(clearfix);
        }

        private styleSecondaryButtons(): void {
            const allButtons = Array.from(document.querySelectorAll('.button-secondary'))
                .filter(btn =>
                    !(btn.closest('.main-nav')) &&
                    !this.excludedClasses.some(cls => btn.classList.contains(cls))
                );

            allButtons.forEach(btn => this.applyButtonStyles(btn as HTMLElement));
        }

        private applyButtonStyles(btn: HTMLElement): void {
            btn.style.boxSizing = 'border-box';
            btn.style.height = '32px';
            btn.style.lineHeight = 'normal';
            btn.style.color = 'var(--color-main-text)';
            btn.style.fontSize = 'var(--default-font-size)';
            btn.style.minWidth = '62px';
            btn.style.backgroundColor = 'var(--color-background-dark)';
            btn.style.border = '1px solid var(--color-border-dark)';
            btn.style.borderRadius = 'var(--border-radius)';
            btn.style.margin = '5px';
            btn.style.verticalAlign = 'middle';
            btn.style.width = 'max-content';
        }

        private applyResponsiveRules(): void {
            const width = window.innerWidth;

            if (width <= 800) {
                const documentHeader = document.querySelector('.main-nav.hasnotebookbar:not(.readonly) #document-header') as HTMLElement;
                if (documentHeader) documentHeader.style.display = 'none';
            }

            if (width <= 900) {
                const documentTitlebar = document.querySelector('.main-nav.hasnotebookbar:not(.readonly) #document-titlebar') as HTMLElement;
                if (documentTitlebar) documentTitlebar.style.display = 'none';

                const tabsContainer = document.querySelector('.notebookbar-tabs-container') as HTMLElement;
                if (tabsContainer) tabsContainer.style.flex = '1 1 auto';
            }
        }

        private observeResize(): void {
            window.addEventListener('resize', () => {
                this.applyResponsiveRules();
            });
        }

        private applyExtraStyles(): void {
            const documentNameInput = document.querySelector('.main-nav:not(.hasnotebookbar) #document-name-input.editable') as HTMLElement;
            if (documentNameInput) {
                documentNameInput.style.fontSize = 'var(--default-font-size)';
                documentNameInput.style.paddingBottom = '2px';
            }

            const closeButtonWrapperSeparator = document.querySelector('.main-nav.hasnotebookbar #closebuttonwrapperseparator') as HTMLElement;
            if (closeButtonWrapperSeparator) {
                closeButtonWrapperSeparator.style.background = 'var(--color-background-darker)';
                closeButtonWrapperSeparator.style.width = '1px';
                closeButtonWrapperSeparator.style.height = '14px';
                closeButtonWrapperSeparator.style.marginInline = '4px';
            }

            const closeButtonWrapper = document.querySelector('.main-nav:not(.hasnotebookbar) ~ #closebuttonwrapper') as HTMLElement;
            if (closeButtonWrapper) {
                closeButtonWrapper.style.height = '38px';

                const closeButton = closeButtonWrapper.querySelector('#closebutton') as HTMLElement;
                if (closeButton) {
                    closeButton.style.background = "url('images/closedoc.svg') no-repeat center/35px";
                }
            }
        }

        private applyAdditionalLayoutStyles(): void {
            const mainNav = this.mainNav as HTMLElement;
            if (!mainNav) return;

            // Overriding main-nav base styles
            mainNav.style.height = '0';
            mainNav.style.width = '100%';
            mainNav.style.margin = '0';
            mainNav.style.setProperty('-webkit-overflow-scrolling', 'touch');
            mainNav.style.overflow = 'scroll';
            mainNav.style.zIndex = '1010';
            mainNav.style.bottom = '34px';
            mainNav.style.backgroundColor = '#00000050';
            mainNav.style.display = 'none';

            // When .hasnotebookbar is present
            if (mainNav.classList.contains('hasnotebookbar')) {
                const documentHeader = document.querySelector('.main-nav.hasnotebookbar #document-header') as HTMLElement;
                if (documentHeader) {
                    documentHeader.style.height = '100%';
                    documentHeader.style.background = 'transparent';
                    documentHeader.style.alignItems = 'center';
                    documentHeader.style.display = 'flex';
                }

                mainNav.style.overflow = 'visible';
                mainNav.style.display = 'flex';
                mainNav.style.flexDirection = 'row';
                mainNav.style.alignItems = 'center';

                const tabsContainer = document.querySelector('.main-nav.readonly.hasnotebookbar .notebookbar-tabs-container') as HTMLElement;
                if (tabsContainer) tabsContainer.style.display = 'none';

                const readonlyTitlebar = document.querySelector('.main-nav.readonly.hasnotebookbar #document-titlebar') as HTMLElement;
                if (readonlyTitlebar) readonlyTitlebar.style.width = 'auto';

                const readonlyInput = document.querySelector('.main-nav.readonly.hasnotebookbar #document-name-input') as HTMLElement;
                if (readonlyInput) readonlyInput.style.minWidth = '100%';

                const pencilIcon = document.querySelector('.main-nav.readonly.hasnotebookbar #document-title-pencil') as HTMLElement;
                if (pencilIcon) {
                    pencilIcon.style.minWidth = 'var(--btn-size)';
                    pencilIcon.style.margin = '0';
                }
            }

            // Hide document-name-input if not readonly
            const inputHide = document.querySelector('.main-nav:not(.readonly) #document-name-input') as HTMLElement;
            if (inputHide) inputHide.style.display = 'none';
        }

        public setNotebookbar(enabled: boolean): void {
            if (this.mainNav) {
                this.mainNav.classList.toggle('hasnotebookbar', enabled);
                this.applyMainNavStyles();
            }
        }


        public prependDocLogoHeader(docLogoHeader: HTMLElement): void {
            if (this.mainNav) {
                this.mainNav.insertBefore(docLogoHeader, this.mainNav.firstChild);
            }
        }
        public removeDocumentHeader(): void {
            const header = this.mainNav?.querySelector('#document-header');
            if (header) {
                header.remove();
            }
        }
        public removeNotebookbarClass(): void {
            this.mainNav?.classList.remove('hasnotebookbar');
        }
        public removeReadonlyClass(): void {
            this.mainNav?.classList.remove('readonly');
        }
        public addReadonlyClass(): void {
            this.mainNav?.classList.add('readonly');
        }


        public getMainNavWidth(): number | null {
            if (!this.mainNav) return null;
            const width = window.getComputedStyle(this.mainNav).width;
            return parseInt(width, 10);
        }

        public registerMainNavClick(map: any): void {
            const mainNav = document.querySelector('.main-nav') as HTMLElement | null;
            if (!mainNav) return;

            mainNav.addEventListener('click', (event: MouseEvent) => {
                const target = event.target as HTMLElement;

                const isNavClick =
                    target.nodeName === 'NAV' ||
                    target.parentElement?.nodeName === 'NAV' ||
                    target.parentElement?.id === 'document-titlebar';

                if (isNavClick) {
                    map.fire('editorgotfocus');
                }
            });


        }


        public getMainNav(): HTMLElement | null {
            return document.querySelector('.main-nav');
        }




        // Show main-nav
        public showMainNav(): void {
            if (this.mainNav) {
                this.mainNav.style.display = 'block';
            }
        }

        // Hide main-nav
        public hideMainNav(): void {
            if (this.mainNav) {
                this.mainNav.style.display = 'none';
            }
        }

        // Check if main-nav is hidden
        public isMainNavHidden(): boolean {
            if (this.mainNav) {
                return getComputedStyle(this.mainNav).display === 'none';
            }
            return false;
        }
    }

    export const menuAndTitleBar = new MenuAndTitleBar();
}
