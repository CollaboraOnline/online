if ENABLE_CYPRESS

abs_dir = $(if $(filter $(abs_builddir),$(abs_srcdir)),.,$(abs_srcdir))
CYPRESS_BINARY = ${abs_builddir}/node_modules/cypress/bin/cypress
PID_FILE=$(abs_builddir)/loolwsd.pid

DESKTOP_USER_AGENT = "cypress"
DESKTOP_TEST_FOLDER = ${abs_srcdir}/integration_tests/desktop
DESKTOP_DATA_FOLDER = ${abs_srcdir}/data/desktop/
DESKTOP_WORKDIR = ${abs_builddir}/workdir/desktop/

MOBILE_USER_AGENT = "cypress mobile"
MOBILE_TEST_FOLDER = ${abs_srcdir}/integration_tests/mobile
MOBILE_DATA_FOLDER = ${abs_srcdir}/data/mobile/
MOBILE_WORKDIR = ${abs_builddir}/workdir/mobile/

ALLOWED_PORTS = $(shell seq 9900 1 9980)
FREE_PORT=$(shell node_modules/get-port-cli/cli.js --host=127.0.0.1 $(ALLOWED_PORTS))

KILL_COMMAND=pkill -F $(PID_FILE) || pkill --signal SIGKILL -F $(PID_FILE)

if HAVE_LO_PATH
check-local: @JAILS_PATH@ node_modules
	$(call run_JS_error_check)
	$(call start_loolwsd)
	$(call run_desktop_tests)
	$(call run_mobile_tests)
	@$(KILL_COMMAND) || true

check-desktop: @JAILS_PATH@ node_modules
	$(call run_JS_error_check)
	$(call start_loolwsd)
	$(call run_desktop_tests,$(spec))
	@$(KILL_COMMAND) || true

check-mobile: @JAILS_PATH@ node_modules
	$(call run_JS_error_check)
	$(call start_loolwsd)
	$(call run_mobile_tests,$(spec))
	@$(KILL_COMMAND) || true

run-desktop: @JAILS_PATH@ node_modules
	$(call start_loolwsd)
	@echo
	@echo "Open cypress with desktop tests..."
	@echo
	$(CYPRESS_BINARY) open --config integrationFolder=$(DESKTOP_TEST_FOLDER),userAgent=$(DESKTOP_USER_AGENT) \
			--env DATA_FOLDER=$(DESKTOP_DATA_FOLDER),WORKDIR=$(DESKTOP_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			|| true
	@$(KILL_COMMAND) || true

run-mobile: @JAILS_PATH@ node_modules
	$(call start_loolwsd)
	@echo
	@echo "Open cypress with mobile tests..."
	@echo
	$(CYPRESS_BINARY) open --config integrationFolder=$(MOBILE_TEST_FOLDER),userAgent=$(MOBILE_USER_AGENT) \
			--env DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MOBILE_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			|| true
	@$(KILL_COMMAND) || true

define run_JS_error_check
	@echo "Checking for JS errors in test code..."
	@echo
	@NODE_PATH=${abs_dir}/node_modules $(NODE) node_modules/eslint/bin/eslint.js $(abs_srcdir) \
		--ignore-path $(abs_srcdir)/.eslintignore --config $(abs_top_srcdir)/loleaflet/.eslintrc
	@echo
endef

define start_loolwsd
	@echo "Found available port for testing: $(FREE_PORT)"
	@echo
	@echo "Launching loolwsd..."
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@echo
	../loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			--o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			--disable-ssl \
			--o:admin_console.username=admin --o:admin_console.password=admin \
			--o:logging.file[@enable]=true --o:logging.level=trace > /dev/null 2>&1 \
			--port=$(FREE_PORT) \
			--pidfile=$(PID_FILE) &
	@node_modules/wait-on/bin/wait-on http://localhost:$(FREE_PORT) --timeout 60000
	@echo
endef

define run_desktop_tests
	@echo
	@echo "Running cypress desktop tests..."
	@echo
	$(CYPRESS_BINARY) run --browser $(CHROME) \
			--config integrationFolder=$(DESKTOP_TEST_FOLDER),userAgent=$(DESKTOP_USER_AGENT) \
			--headless \
			--env DATA_FOLDER=$(DESKTOP_DATA_FOLDER),WORKDIR=$(DESKTOP_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			$(if $(1), --spec=${abs_dir}/integration_tests/desktop/$(1)) \
			|| ($(KILL_COMMAND) && false)
endef

define run_mobile_tests
	@echo
	@echo "Running cypress mobile tests..."
	@echo
	$(CYPRESS_BINARY) run --browser $(CHROME) \
			--config integrationFolder=$(MOBILE_TEST_FOLDER),userAgent=$(MOBILE_USER_AGENT) \
			--headless \
			--env DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MOBILE_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			$(if $(1), --spec=$(abs_dir)/integration_tests/mobile/$(1)) \
			|| ($(KILL_COMMAND) && false)
endef

node_modules:
	@npm install
	@touch node_modules

endif

clean-local:
	rm -rf node_modules
	rm -rf workdir
	rm -rf cypress
	rm -rf package-lock.json
endif
