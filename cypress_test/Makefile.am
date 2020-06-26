if ENABLE_CYPRESS

export NODE_PATH=$(abs_builddir)/node_modules

abs_dir = $(if $(filter $(abs_builddir),$(abs_srcdir)),.,$(abs_srcdir))
CYPRESS_BINARY = $(abs_builddir)/node_modules/cypress/bin/cypress
ESLINT_BINARY = $(abs_builddir)/node_modules/eslint/bin/eslint.js
WAIT_ON_BINARY = $(abs_builddir)/node_modules/wait-on/bin/wait-on
GET_PORT_BINARY = $(abs_builddir)/node_modules/get-port-cli/cli.js
NPM_INSTALLED = $(abs_builddir)/workdir/npm_installed

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

ALLOWED_PORTS = $(shell seq 9900 1 9980)
KILL_COMMAND=pkill -F $(PID_FILE) || pkill --signal SIGKILL -F $(PID_FILE)
PARALLEL_BUILD = $(findstring -j,$(MAKEFLAGS))
DISPLAY_NUMBER = 100
HEADLESS_BUILD := $(findstring Command failed,$(shell xhost > /dev/null 2>&1 || echo "Command failed, so we are in a headless environment."))
export DISPLAY=$(if $(HEADLESS_BUILD),:$(DISPLAY_NUMBER),$(shell echo $$DISPLAY))

CORE_VERSION := $(shell "@LO_PATH@"/program/soffice.bin --version 2> /dev/null)

COMMA :=,

if ENABLE_DEBUG
FILTER_DEBUG=cypress:electron,cypress:launcher
export DEBUG=$(if $(ENABLE_LOGGING),$(FILTER_DEBUG),)
endif

# We use a hard coded hash here, because of this issue:
# https://github.com/cypress-io/cypress/issues/6891
WSD_VERSION_HASH := "11111111"

if HAVE_LO_PATH

MOBILE_TEST_FILES=$(subst $(MOBILE_TEST_FOLDER)/,,$(wildcard $(MOBILE_TEST_FOLDER)/*_spec.js) $(wildcard $(MOBILE_TEST_FOLDER)/*/*_spec.js))

DEKSTOP_TEST_FILES=$(subst $(DESKTOP_TEST_FOLDER)/,,$(wildcard $(DESKTOP_TEST_FOLDER)/*_spec.js) $(wildcard $(DESKTOP_TEST_FOLDER)/*/*_spec.js))

MOBILE_TEST_FILES_DONE= \
	$(foreach test_file,$(MOBILE_TEST_FILES),$(MOBILE_TRACK_FOLDER)/$(test_file).done)

DESKTOP_TEST_FILES_DONE= \
	$(foreach test_file,$(DEKSTOP_TEST_FILES),$(DESKTOP_TRACK_FOLDER)/$(test_file).done)

check-local: do-check
	$(if $(wildcard $(ERROR_LOG)),$(error CypressError: some tests failed!))

do-check: $(DESKTOP_TEST_FILES_DONE) $(MOBILE_TEST_FILES_DONE)
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

run-desktop: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	@echo
	@echo "Open cypress with desktop tests..."
	@echo
	$(call run_interactive_test,DESKTOP,$(spec)) \
			|| true
	@$(KILL_COMMAND) || true

run-mobile: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	@echo
	@echo "Open cypress with mobile tests..."
	@echo
	$(call run_interactive_test,MOBILE,$(spec)) \
			|| true
	@$(KILL_COMMAND) || true

run-cov: @JAILS_PATH@ $(NODE_BINS)
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
	$(call start_loolwsd)
	$(call run_desktop_tests,,,COVERAGE_RUN="1")
	$(call run_mobile_tests,,,COVERAGE_RUN="1")
	@$(KILL_COMMAND) || true

define run_JS_error_check
	@echo "Checking for JS errors in test code..."
	@echo
	@$(NODE) $(ESLINT_BINARY) $(abs_srcdir) \
		--ignore-path $(abs_srcdir)/.eslintignore --config $(abs_srcdir)/.eslintrc
	@echo
endef

define start_loolwsd
	$(eval FREE_PORT:=$(shell $(GET_PORT_BINARY) --host=127.0.0.1 $(ALLOWED_PORTS)))
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
	--config integrationFolder=$(DESKTOP_TEST_FOLDER),supportFile=$(SUPPORT_FILE),userAgent=$(DESKTOP_USER_AGENT) \
	--env DATA_FOLDER=$(DESKTOP_DATA_FOLDER),WORKDIR=$(DESKTOP_WORKDIR),WSD_VERSION_HASH=$(WSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)"

MOBILE_CONFIG = \
	--config integrationFolder=$(MOBILE_TEST_FOLDER),supportFile=$(SUPPORT_FILE),userAgent=$(MOBILE_USER_AGENT) \
	--env DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MOBILE_WORKDIR),WSD_VERSION_HASH=$(WSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)"

define run_interactive_test
	$(if $(2),\
		$(CYPRESS_BINARY) run \
			--browser $(CHROME) \
			--headed --no-exit \
			$(if $(findstring DESKTOP,$(1)),\
				$(DESKTOP_CONFIG) \
				--spec=$(abs_dir)/integration_tests/desktop/$(2),\
				$(MOBILE_CONFIG) \
				--spec=$(abs_dir)/integration_tests/mobile/$(2)),\
		$(CYPRESS_BINARY) open \
			$(if $(findstring DESKTOP,$(1)),$(DESKTOP_CONFIG),$(MOBILE_CONFIG)))
endef

define run_desktop_tests
	@echo $(if $(1),"Running cypress desktop test: $(1)","Running cypress desktop tests...")
	@echo
	$(eval RUN_COMMAND = \
		$(CYPRESS_BINARY) run \
			--browser $(CHROME) \
			--headless \
			$(DESKTOP_CONFIG)$(if $(3),$(COMMA)$(3))  \
			$(if $(1), --spec=$(abs_dir)/integration_tests/desktop/$(1)) \
			$(if $(PARALLEL_BUILD),,|| ($(KILL_COMMAND) && false)))
	$(if $(PARALLEL_BUILD),\
		$(call execute_run_parallel,$(RUN_COMMAND),$(2),desktop,$(1))\
	,\
		$(RUN_COMMAND)\
	)
endef

define run_mobile_tests
	@echo $(if $(1),"Running cypress mobile test: $(1)","Running cypress mobile tests...")
	@echo
	$(eval RUN_COMMAND = \
		$(CYPRESS_BINARY) run \
			--browser $(CHROME) \
			--headless \
			$(MOBILE_CONFIG)$(if $(3),$(COMMA)$(3)) \
			$(if $(1), --spec=$(abs_dir)/integration_tests/mobile/$(1)) \
			$(if $(PARALLEL_BUILD),,|| ($(KILL_COMMAND) && false)))
	$(if $(PARALLEL_BUILD),\
		$(call execute_run_parallel,$(RUN_COMMAND),$(2),mobile,$(1))\
	,\
		$(RUN_COMMAND)\
	)
endef

ERROR_MATCHER = "Error:\|Command failed:\|Timed out retrying"

define execute_run_parallel
	@mkdir -p $(dir $(2)) && touch $(2) && \
	echo "`echo $(1) && $(1)`" > $(2) 2>&1 && \
	if [ -z `grep -o -m 1 $(ERROR_MATCHER) $(2)` ];\
		then cat $(2);\
		elif [ -z $(CYPRESS_NO_SECOND_CHANCE) ]; \
		then echo "Second chance!" > $(2) && \
		     echo "`echo $(1) && $(1)`" >> $(2) 2>&1 && \
		     if [ -z `grep -o -m 1 $(ERROR_MATCHER) $(2)` ];\
			then cat $(2);\
			else cat $(2) >> $(ERROR_LOG) && \
			     echo -e $(call error_output_string,$(3),$(4)) >> $(ERROR_LOG); \
		     fi;\
		else cat $(2) >> $(ERROR_LOG) && \
		     echo -e $(call error_output_string,$(3),$(4)) >> $(ERROR_LOG); \
	fi;
endef

define error_output_string
"\n\
CypressError: a test failed, please do one of the following:\n\n\
Run the failing test in headless mode:\n\
\tcd cypress_test && make check-$(1) spec=$(2)\n\n\
Open the failing test in the interactive test runner:\n\
\tcd cypress_test && make run-$(1) spec=$(2)\n"
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

endif

clean-local:
	$(CYPRESS_BINARY) cache clear || true
	rm -rf node_modules
	rm -rf workdir
	rm -rf cypress
	rm -rf package-lock.json
	rm -rf .nyc_output
	rm -rf coverage
endif
