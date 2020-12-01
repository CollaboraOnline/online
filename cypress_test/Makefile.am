if ENABLE_CYPRESS

export NODE_PATH=$(abs_builddir)/node_modules

abs_dir = $(if $(filter $(abs_builddir),$(abs_srcdir)),.,$(abs_srcdir))
CYPRESS_BINARY = $(abs_builddir)/node_modules/cypress/bin/cypress
ESLINT_BINARY = $(abs_builddir)/node_modules/eslint/bin/eslint.js
WAIT_ON_BINARY = $(abs_builddir)/node_modules/wait-on/bin/wait-on
GET_PORT_BINARY = $(abs_builddir)/node_modules/get-port-cli/cli.js
NPM_INSTALLED = $(abs_builddir)/workdir/npm_installed

PARALLEL_SCRIPT = $(abs_srcdir)/run_parallel.sh

PID_FILE=$(abs_builddir)/workdir/loolwsd.pid
ERROR_LOG=$(abs_builddir)/workdir/error.log

SUPPORT_FILE_ABS = $(abs_srcdir)/support/index.js
SUPPORT_FILE = $(if $(findstring $(abs_srcdir),$(abs_builddir)),support/index.js,$(SUPPORT_FILE_ABS))

DESKTOP_USER_AGENT = "cypress"
DESKTOP_TEST_FOLDER = $(abs_srcdir)/integration_tests/desktop
DESKTOP_DATA_FOLDER = $(abs_srcdir)/data/desktop/
DESKTOP_WORKDIR = $(abs_builddir)/workdir/desktop/
DESKTOP_TRACK_FOLDER=$(abs_builddir)/workdir/track/desktop

MOBILE_USER_AGENT = "cypress-mobile"
MOBILE_TEST_FOLDER = $(abs_srcdir)/integration_tests/mobile
MOBILE_DATA_FOLDER = $(abs_srcdir)/data/mobile/
MOBILE_WORKDIR = $(abs_builddir)/workdir/mobile/
MOBILE_TRACK_FOLDER=$(abs_builddir)/workdir/track/mobile

MULTIUSER_TEST_FOLDER = $(abs_srcdir)/integration_tests/multiuser
MULTIUSER_DATA_FOLDER = $(abs_srcdir)/data/multiuser/
MULTIUSER_WORKDIR = $(abs_builddir)/workdir/multiuser/
MULTIUSER_TRACK_FOLDER=$(abs_builddir)/workdir/track/multiuser

ALLOWED_PORTS = $(shell seq 9900 1 9980)
KILL_COMMAND=pkill -F $(PID_FILE) || pkill --signal SIGKILL -F $(PID_FILE)
PARALLEL_BUILD = $(findstring -j,$(MAKEFLAGS))
DISPLAY_NUMBER = 100
HEADLESS_BUILD := $(findstring Command failed,$(shell xhost > /dev/null 2>&1 || echo "Command failed, so we are in a headless environment."))
export DISPLAY=$(if $(HEADLESS_BUILD),:$(DISPLAY_NUMBER),$(shell echo $$DISPLAY))

COMMA :=,
EMPTY :=
SPACE :=$(EMPTY) $(EMPTY)

CORE_VERSION := $(subst $(SPACE),_,$(shell "@LO_PATH@"/program/soffice.bin --version 2> /dev/null))

BROWSER:=$(if $(CYPRESS_BROWSER),$(CYPRESS_BROWSER),$(CHROME))

if ENABLE_DEBUG
FILTER_DEBUG=cypress:electron,cypress:launcher
export DEBUG=$(if $(ENABLE_LOGGING),$(FILTER_DEBUG),)
endif

if HAVE_LO_PATH

MOBILE_TEST_FILES=$(subst $(MOBILE_TEST_FOLDER)/,,$(wildcard $(MOBILE_TEST_FOLDER)/*_spec.js) $(wildcard $(MOBILE_TEST_FOLDER)/*/*_spec.js))

DEKSTOP_TEST_FILES=$(subst $(DESKTOP_TEST_FOLDER)/,,$(wildcard $(DESKTOP_TEST_FOLDER)/*_spec.js) $(wildcard $(DESKTOP_TEST_FOLDER)/*/*_spec.js))

MULTIUSER_TESTS= \
	writer/paragraph_prop \
	writer/sidebar_visibility \
	writer/simultaneous_typing \
	calc/sheet_operations \
	impress/slide_operations

MOBILE_TEST_FILES_DONE= \
	$(foreach test_file,$(MOBILE_TEST_FILES),$(MOBILE_TRACK_FOLDER)/$(test_file).done)

DESKTOP_TEST_FILES_DONE= \
	$(foreach test_file,$(DEKSTOP_TEST_FILES),$(DESKTOP_TRACK_FOLDER)/$(test_file).done)

MULTIUSER_TESTS_DONE= \
	$(MULTIUSER_TRACK_FOLDER)/multiuser_tests.done

check-local: do-check
	$(if $(wildcard $(ERROR_LOG)),$(error CypressError: some tests failed!))

do-check: $(DESKTOP_TEST_FILES_DONE) $(MOBILE_TEST_FILES_DONE) $(MULTIUSER_TESTS_DONE)
	@$(KILL_COMMAND) || true
	$(if $(HEADLESS_BUILD),@pkill Xvfb,)
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

$(PID_FILE): @JAILS_PATH@ $(NODE_BINS)
	@rm -f $(ERROR_LOG)
	$(call run_JS_error_check)
	$(if $(HEADLESS_BUILD),$(call start_Xvfb),)
	$(call start_loolwsd)

$(MOBILE_TEST_FILES_DONE): $(PID_FILE) $(DESKTOP_TEST_FILES_DONE)
	$(if $(PARALLEL_BUILD),\
		$(call run_mobile_tests,$(subst $(MOBILE_TRACK_FOLDER)/,,$(basename $@)),$(basename $@).log),\
		$(call run_mobile_tests))
	$(if $(PARALLEL_BUILD),\
		@mkdir -p $(dir $@) && touch $@\
		,\
		@$(foreach done_file,$(MOBILE_TEST_FILES_DONE),mkdir -p $(dir $(done_file)) && touch $(done_file) &&) true\
	)

$(DESKTOP_TEST_FILES_DONE): $(PID_FILE)
	$(if $(PARALLEL_BUILD),\
		$(call run_desktop_tests,$(subst $(DESKTOP_TRACK_FOLDER)/,,$(basename $@)),$(basename $@).log),\
		$(call run_desktop_tests))
	$(if $(PARALLEL_BUILD),\
		@mkdir -p $(dir $@) && touch $@\
		,\
		@$(foreach done_file,$(DESKTOP_TEST_FILES_DONE),mkdir -p $(dir $(done_file)) && touch $(done_file) &&) true\
	)

$(MULTIUSER_TESTS_DONE): $(PID_FILE) $(MOBILE_TEST_FILES_DONE)
	$(foreach test,$(MULTIUSER_TESTS),$(call run_multiuser_test,$(test),$(1)))
	@mkdir -p $(dir $@) && touch $@

check-desktop: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	$(call run_desktop_tests,$(spec))
	@$(KILL_COMMAND) || true

check-mobile: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	$(call run_mobile_tests,$(spec))
	@$(KILL_COMMAND) || true

check-multi: do-multi-check-log
	$(if $(wildcard $(ERROR_LOG)),$(error CypressError: some tests failed!))

do-multi-check-log: do-multi-check
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

do-multi-check: @JAILS_PATH@ $(NODE_BINS)
	@rm -f $(ERROR_LOG)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	$(if $(spec), \
		$(call run_multiuser_test,$(spec)), \
		$(call run_all_multiuser_tests))
	@$(KILL_COMMAND) || true

check-interfer-mobile: do-interfer-mobile-check-log
	$(if $(wildcard $(ERROR_LOG)),$(error CypressError: some tests failed!))

do-interfer-mobile-check-log: do-interfer-mobile-check
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

do-interfer-mobile-check: @JAILS_PATH@ $(NODE_BINS)
	@rm -f $(ERROR_LOG)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	$(if $(spec), \
		$(call run_mobile_interference_test,$(spec)), \
		$(call run_mobile_interference_tests))
	@$(KILL_COMMAND) || true

run-desktop: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	@echo
	@echo "Open cypress with desktop tests..."
	@echo
	$(call run_interactive_desktop,$(spec)) || true
	@$(KILL_COMMAND) || true

run-mobile: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	@echo
	@echo "Open cypress with mobile tests..."
	@echo
	$(call run_interactive_mobile,$(spec)) || true
	@$(KILL_COMMAND) || true

run-multi: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	@echo
	@echo "Running multi-user test in interactive test runner..."
	@echo
	$(if $(filter 1,$(user)), \
		$(eval BACKGROUND_USER_SPEC=$(spec)_user2_spec.js), \
		$(eval BACKGROUND_USER_SPEC=$(spec)_user1_spec.js))
	$(if $(filter 1,$(user)), \
		$(eval INTERACTIVE_USER_SPEC=$(spec)_user1_spec.js), \
		$(eval INTERACTIVE_USER_SPEC=$(spec)_user2_spec.js))
	$(eval BACKGROUND_USER_LOG=$(MULTIUSER_TRACK_FOLDER)/$(BACKGROUND_USER_SPEC).log)
	@$(PARALLEL_SCRIPT) \
		--browser $(BROWSER) \
		--config $(MULTIUSER_CONFIG) \
		--env $(MULTIUSER_ENV) \
		--spec $(BACKGROUND_USER_SPEC) \
		--type multi-user \
		--log-file $(BACKGROUND_USER_LOG) &
	$(call run_interactive_multi,$(INTERACTIVE_USER_SPEC)) || true
	@$(KILL_COMMAND) || true

run-cov: do-run-cov
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

do-run-cov: @JAILS_PATH@ $(NODE_BINS)
	@echo
	@echo "Setup coverage tools..."
	@echo
	rm -rf .nyc_output
	rm -rf coverage
	npm install @cypress/code-coverage --no-save
	@echo "import '@cypress/code-coverage/support';" >> $(SUPPORT_FILE_ABS)
	@echo "" >> $(SUPPORT_FILE_ABS)
	cd .. && npx nyc instrument --compact=false loleaflet/src loleaflet/dist/src && cd cypress_test
	@echo
	@echo "Run all tests..."
	@echo
	@rm -f $(ERROR_LOG)
	$(call start_loolwsd)
	$(call run_desktop_tests,,,COVERAGE_RUN="1")
	$(call run_mobile_tests,,,COVERAGE_RUN="1")
	$(call run_all_multiuser_tests,COVERAGE_RUN="1")
	@$(KILL_COMMAND) || true

@JAILS_PATH@:
	mkdir -p $@

define run_JS_error_check
	@echo "Checking for JS errors in test code..."
	@echo
	@$(NODE) $(ESLINT_BINARY) $(abs_srcdir) \
		--ignore-path $(abs_srcdir)/.eslintignore --config $(abs_srcdir)/.eslintrc
	@echo
endef

define start_loolwsd
	$(if $(findstring nextcloud, $(CYPRESS_INTEGRATION)),\
		$(eval FREE_PORT:=9980),\
		$(if $(findstring php-proxy, $(CYPRESS_INTEGRATION)),
			$(eval FREE_PORT:=9982),\
			$(eval FREE_PORT:=$(shell $(GET_PORT_BINARY) --host=127.0.0.1 $(ALLOWED_PORTS)))))
	@echo "Found available port for testing: $(FREE_PORT)"
	@echo
	@echo "Launching loolwsd..."
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@echo
	../loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			--o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			--disable-ssl \
			--o:admin_console.username=admin --o:admin_console.password=admin \
			--o:logging.file[@enable]=true --o:logging.level=trace \
			--port=$(FREE_PORT) \
			--pidfile=$(PID_FILE) \
			$(if $(findstring php-proxy, $(CYPRESS_INTEGRATION)),--o:net.proxy_prefix=true) \
			 > /dev/null 2>&1 &
	@$(WAIT_ON_BINARY) http://localhost:$(FREE_PORT) --timeout 60000
	@echo
endef

#https://docs.cypress.io/guides/guides/continuous-integration.html#Xvfb
define start_Xvfb
	@echo "Launching Xvfb..."
	Xvfb :$(DISPLAY_NUMBER) -screen 0 1280x800x24 &
	while [ ! -f /tmp/.X$(DISPLAY_NUMBER)-lock ] ; do sleep 1; done
	@echo
endef

DESKTOP_CONFIG = \
	integrationFolder=$(DESKTOP_TEST_FOLDER),supportFile=$(SUPPORT_FILE),userAgent=$(DESKTOP_USER_AGENT)

DESKTOP_ENV = \
	DATA_FOLDER=$(DESKTOP_DATA_FOLDER),WORKDIR=$(DESKTOP_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

MOBILE_CONFIG = \
	integrationFolder=$(MOBILE_TEST_FOLDER),supportFile=$(SUPPORT_FILE),userAgent=$(MOBILE_USER_AGENT)

MOBILE_ENV = \
	DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MOBILE_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

MULTIUSER_CONFIG = \
	integrationFolder=$(MULTIUSER_TEST_FOLDER),supportFile=$(SUPPORT_FILE),userAgent=$(DESKTOP_USER_AGENT),defaultCommandTimeout=30000,retries=0

MULTIUSER_ENV = \
	DATA_FOLDER=$(MULTIUSER_DATA_FOLDER),WORKDIR=$(MULTIUSER_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

define run_interactive_desktop
	$(if $(1),\
		$(CYPRESS_BINARY) run \
			--browser $(BROWSER) \
			--headed --no-exit \
			--config $(DESKTOP_CONFIG) \
			--env $(DESKTOP_ENV) \
			--spec=$(abs_dir)/integration_tests/desktop/$(1),\
		$(CYPRESS_BINARY) open \
			--config $(DESKTOP_CONFIG) \
			--env $(DESKTOP_ENV))
endef

define run_interactive_mobile
	$(if $(1),\
		$(CYPRESS_BINARY) run \
			--browser $(BROWSER) \
			--headed --no-exit \
			--config $(MOBILE_CONFIG) \
			--env $(MOBILE_ENV) \
			--spec=$(abs_dir)/integration_tests/mobile/$(1),\
		$(CYPRESS_BINARY) open \
			--config $(MOBILE_CONFIG) \
			--env $(MOBILE_ENV))
endef

define run_interactive_multi
	$(CYPRESS_BINARY) run \
		--browser $(BROWSER) \
		--headed --no-exit \
		--config $(MULTIUSER_CONFIG) \
		--env $(MULTIUSER_ENV) \
		--spec=$(abs_dir)/integration_tests/multiuser/$(1)
endef

define run_desktop_tests
	@echo $(if $(1),"Running cypress desktop test: $(1)","Running cypress desktop tests...")
	@echo
	$(if $(PARALLEL_BUILD),\
		@$(PARALLEL_SCRIPT) \
			--browser $(BROWSER) \
			--config $(DESKTOP_CONFIG) \
			--env $(DESKTOP_ENV)$(if $(3),$(COMMA)$(3)) \
			--spec $(1) \
			--type desktop \
			--log-file $(2) \
		,\
		$(CYPRESS_BINARY) run \
			--browser $(BROWSER) \
			--headless \
			--config $(DESKTOP_CONFIG) \
			--env $(DESKTOP_ENV)$(if $(3),$(COMMA)$(3)) \
			$(if $(1), --spec=$(abs_dir)/integration_tests/desktop/$(1)) \
			|| ($(KILL_COMMAND) && false) \
	)
endef

define run_mobile_tests
	@echo $(if $(1),"Running cypress mobile test: $(1)","Running cypress mobile tests...")
	@echo
	$(if $(PARALLEL_BUILD),\
		@$(PARALLEL_SCRIPT) \
			--browser $(BROWSER) \
			--config $(MOBILE_CONFIG) \
			--env $(MOBILE_ENV)$(if $(3),$(COMMA)$(3)) \
			--spec $(1) \
			--type mobile \
			--log-file $(2) \
		,\
		$(CYPRESS_BINARY) run \
			--browser $(BROWSER) \
			--headless \
			--config $(MOBILE_CONFIG) \
			--env $(MOBILE_ENV)$(if $(3),$(COMMA)$(3)) \
			$(if $(1), --spec=$(abs_dir)/integration_tests/mobile/$(1)) \
			|| ($(KILL_COMMAND) && false) \
	)
endef

define run_all_multiuser_tests
	$(foreach test,$(MULTIUSER_TESTS),$(call run_multiuser_test,$(test),$(1)))
endef

define run_multiuser_test
	$(eval USER1_SPEC=$(strip $(1))_user1_spec.js)
	$(eval USER2_SPEC=$(strip $(1))_user2_spec.js)
	$(eval USER1_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER1_SPEC).log)
	$(eval USER2_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER2_SPEC).log)
	@echo "Running cypress multi-user test: $(USER1_SPEC) - $(USER2_SPEC)"
	@echo
	@$(PARALLEL_SCRIPT) \
		--browser $(BROWSER) \
		--config $(MULTIUSER_CONFIG) \
		--env $(MULTIUSER_ENV)$(if $(2),$(COMMA)$(2)) \
		--spec $(USER1_SPEC) \
		--type multi-user \
		--log-file $(USER1_LOG) & \
	sleep 5 && \
	$(PARALLEL_SCRIPT) \
		--browser $(BROWSER) \
		--config $(MULTIUSER_CONFIG) \
		--env $(MULTIUSER_ENV)$(if $(2),$(COMMA)$(2)) \
		--spec $(USER2_SPEC) \
		--type multi-user \
		--log-file $(USER2_LOG) && \
	wait # waits the background process to be finished
endef

INTERFER_MOBILE_CONFIG1 = \
	integrationFolder=$(MOBILE_TEST_FOLDER),supportFile=$(SUPPORT_FILE),userAgent=$(MOBILE_USER_AGENT),defaultCommandTimeout=30000,retries=0

INTERFER_MOBILE_ENV1 = \
	DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MULTIUSER_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION),INTERFERENCE_TEST=true

INTERFER_MOBILE_CONFIG2 = \
	integrationFolder=$(MULTIUSER_TEST_FOLDER),supportFile=$(SUPPORT_FILE),userAgent=$(MOBILE_USER_AGENT),defaultCommandTimeout=30000,retries=0

INTERFER_MOBILE_ENV2 = \
	DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MULTIUSER_WORKDIR),WSD_VERSION_HASH=$(LOOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

define run_mobile_interference_tests
	$(foreach test,$(MOBILE_TEST_FILES),$(call run_mobile_interference_test,$(test)))
endef

define run_mobile_interference_test
	$(eval USER1_SPEC=$(1))
	$(eval USER2_SPEC=interference_user_spec.js)
	$(eval USER1_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER1_SPEC).log)
	$(eval USER2_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER2_SPEC).log)
	@echo "Running cypress mobile interference test: $(1)"
	@echo
	@$(PARALLEL_SCRIPT) \
		--browser $(BROWSER) \
		--config $(INTERFER_MOBILE_CONFIG1) \
		--env $(INTERFER_MOBILE_ENV1) \
		--spec $(USER1_SPEC) \
		--type mobile \
		--log-file $(USER1_LOG) & \
	sleep 5 && \
	$(PARALLEL_SCRIPT) \
		--browser $(BROWSER) \
		--config $(INTERFER_MOBILE_CONFIG2) \
		--env $(INTERFER_MOBILE_ENV2) \
		--spec $(USER2_SPEC) \
		--type multi-user \
		--log-file $(USER2_LOG) && \
	wait # waits the background process to be finished
endef

NODE_BINS = \
	$(CYPRESS_BINARY) \
	$(ESLINT_BINARY) \
	$(WAIT_ON_BINARY) \
	$(GET_PORT_BINARY)

$(NODE_BINS): $(NPM_INSTALLED);

$(NPM_INSTALLED): package.json eslint_plugin/index.js eslint_plugin/package.json
	@npm install
	@mkdir -p $(dir $(NPM_INSTALLED))
	@touch $(NPM_INSTALLED)

else

check-local:
	$(error CypressError: Can't find LibreOffice core installation!)

endif

clean-local:
	rm -rf node_modules
	rm -rf workdir
	rm -rf cypress
	rm -rf package-lock.json
	rm -rf .nyc_output
	rm -rf coverage
endif
