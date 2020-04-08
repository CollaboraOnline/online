if ENABLE_CYPRESS

abs_dir = $(if $(filter $(abs_builddir),$(abs_srcdir)),.,$(abs_srcdir))
CYPRESS_BINARY = $(abs_builddir)/node_modules/cypress/bin/cypress
ESLINT_BINARY = $(abs_builddir)/node_modules/eslint/bin/eslint.js
WAIT_ON_BINARY = $(abs_builddir)/node_modules/wait-on/bin/wait-on
GET_PORT_BINARY = $(abs_builddir)/node_modules/get-port-cli/cli.js
NPM_INSTALLED = $(abs_builddir)/workdir/npm_installed

PID_FILE=$(abs_builddir)/workdir/loolwsd.pid
ERROR_LOG=$(abs_builddir)/workdir/error.log

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

# We use a hard coded hash here, because of this issue:
# https://github.com/cypress-io/cypress/issues/6891
WSD_VERSION_HASH := "11111111"

if HAVE_LO_PATH
MOBILE_TEST_FILES= \
	calc/alignment_options_spec.js \
	calc/apply_font_spec.js \
	calc/focus_spec.js \
	calc/insertion_wizard_spec.js \
	calc/number_format_spec.js \
	calc/spellchecking_spec.js \
	impress/impress_focus_spec.js \
	impress/spellchecking_spec.js \
	writer/apply_font_spec.js \
	writer/apply_paragraph_properties_spec.js \
	writer/bottom_toolbar_spec.js \
	writer/focus_spec.js \
	writer/insert_field_spec.js \
	writer/insert_formatting_mark_spec.js \
	writer/insert_object_spec.js \
	writer/mobile_wizard_state_spec.js \
	writer/shape_properties_spec.js \
	writer/spellchecking_spec.js \
	writer/table_properties_spec.js \
	writer/toolbar_spec.js

DEKSTOP_TEST_FILES= \
	copy_paste_spec.js \
	example_desktop_test_spec.js \
	shape_operations_spec.js

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

$(MOBILE_TEST_FILES_DONE): $(PID_FILE)
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
	$(CYPRESS_BINARY) open --config integrationFolder=$(DESKTOP_TEST_FOLDER),userAgent=$(DESKTOP_USER_AGENT) \
			--env DATA_FOLDER=$(DESKTOP_DATA_FOLDER),WORKDIR=$(DESKTOP_WORKDIR),WSD_VERSION_HASH=$(WSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			|| true
	@$(KILL_COMMAND) || true

run-mobile: @JAILS_PATH@ $(NODE_BINS)
	$(call run_JS_error_check)
	$(call start_loolwsd)
	@echo
	@echo "Open cypress with mobile tests..."
	@echo
	$(CYPRESS_BINARY) open --config integrationFolder=$(MOBILE_TEST_FOLDER),userAgent=$(MOBILE_USER_AGENT) \
			--env DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MOBILE_WORKDIR),WSD_VERSION_HASH=$(WSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			|| true
	@$(KILL_COMMAND) || true

define run_JS_error_check
	@echo "Checking for JS errors in test code..."
	@echo
	@NODE_PATH=$(abs_dir)/node_modules $(NODE) $(ESLINT_BINARY) $(abs_srcdir) \
		--ignore-path $(abs_srcdir)/.eslintignore --config $(abs_top_srcdir)/loleaflet/.eslintrc
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
	Xvfb :$(DISPLAY_NUMBER) &
	while [ ! -f /tmp/.X$(DISPLAY_NUMBER)-lock ] ; do sleep 1; done
	@echo
endef

define run_desktop_tests
	@echo $(if $(1),"Running cypress desktop test: $(1)","Running cypress desktop tests...")
	@echo
	$(eval RUN_COMMAND = \
		$(CYPRESS_BINARY) run --browser $(CHROME) \
			--config integrationFolder=$(DESKTOP_TEST_FOLDER),userAgent=$(DESKTOP_USER_AGENT) \
			--headless \
			--env DATA_FOLDER=$(DESKTOP_DATA_FOLDER),WORKDIR=$(DESKTOP_WORKDIR),WSD_VERSION_HASH=$(WSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			$(if $(1), --spec=$(abs_dir)/integration_tests/desktop/$(1)) \
			$(if $(PARALLEL_BUILD),,|| ($(KILL_COMMAND) && false)))
	$(if $(PARALLEL_BUILD),\
		$(call execute_run_parallel,$(RUN_COMMAND),$(2))\
	,\
		$(RUN_COMMAND)\
	)
endef

define run_mobile_tests
	@echo $(if $(1),"Running cypress mobile test: $(1)","Running cypress mobile tests...")
	@echo
	$(eval RUN_COMMAND = \
		$(CYPRESS_BINARY) run --browser $(CHROME) \
			--config integrationFolder=$(MOBILE_TEST_FOLDER),userAgent=$(MOBILE_USER_AGENT) \
			--headless \
			--env DATA_FOLDER=$(MOBILE_DATA_FOLDER),WORKDIR=$(MOBILE_WORKDIR),WSD_VERSION_HASH=$(WSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT) \
			$(if $(1), --spec=$(abs_dir)/integration_tests/mobile/$(1)) \
			$(if $(PARALLEL_BUILD),,|| ($(KILL_COMMAND) && false)))
	$(if $(PARALLEL_BUILD),\
		$(call execute_run_parallel,$(RUN_COMMAND),$(2))\
	,\
		$(RUN_COMMAND)\
	)
endef

define execute_run_parallel
	@mkdir -p $(dir $(2)) && touch $(2) && \
	echo "`echo $(1) && $(1)`" > $(2) 2>&1 && \
	if [ -z `grep -o -m 1 "Error:" $(2)` ];\
		then cat $(2);\
		else cat $(2) >> $(ERROR_LOG);\
	fi;
endef

NODE_BINS = \
	$(CYPRESS_BINARY) \
	$(ESLINT_BINARY) \
	$(WAIT_ON_BINARY) \
	$(GET_PORT_BINARY)

$(NODE_BINS): $(NPM_INSTALLED);

$(NPM_INSTALLED): package.json
	@npm install
	@mkdir -p $(dir $(NPM_INSTALLED))
	@touch $(NPM_INSTALLED)

endif

clean-local:
	rm -rf node_modules
	rm -rf workdir
	rm -rf cypress
	rm -rf package-lock.json
endif
