if ENABLE_CYPRESS

export NODE_PATH=$(abs_builddir)/node_modules

abs_dir = $(if $(filter $(abs_builddir),$(abs_srcdir)),.,$(abs_srcdir))
CYPRESS_BINARY = $(abs_builddir)/node_modules/cypress/bin/cypress
ESLINT_BINARY = $(abs_builddir)/node_modules/eslint/bin/eslint.js
WAIT_ON_BINARY = $(abs_builddir)/node_modules/wait-on/bin/wait-on
GET_PORT_BINARY = $(abs_builddir)/node_modules/get-port-cli/cli.js
NPM_INSTALLED = $(abs_builddir)/workdir/npm_installed
CAPABILITIES = $(if @ENABLE_SETCAP@,true,false)

PARALLEL_SCRIPT = $(abs_srcdir)/run_parallel.sh

PID_FILE=$(abs_builddir)/workdir/coolwsd.pid
ERROR_LOG=$(abs_builddir)/workdir/error.log
COOLWSD_LOG=$(abs_builddir)/cypress/wsd_logs/coolwsd.log
COOLWSD_OUTPUT=$(abs_builddir)/cypress/wsd_logs/coolwsd_output.log

SUPPORT_FILE_ABS = $(abs_srcdir)/support/index.js
SUPPORT_FILE = $(if $(findstring $(abs_srcdir),$(abs_builddir)),support/index.js,$(SUPPORT_FILE_ABS))

DESKTOP_USER_AGENT = "cypress"
DESKTOP_TEST_FOLDER = $(abs_srcdir)/integration_tests/desktop
DESKTOP_DATA_FOLDER = $(abs_srcdir)/data/desktop/
DESKTOP_DATA_WORKDIR = $(abs_builddir)/workdir/data/desktop/
DESKTOP_TRACK_FOLDER=$(abs_builddir)/workdir/track/desktop
DESKTOP_NB_TRACK_FOLDER=$(abs_builddir)/workdir/track/notebookbar

MOBILE_USER_AGENT = "cypress-mobile"
MOBILE_TEST_FOLDER = $(abs_srcdir)/integration_tests/mobile
MOBILE_DATA_FOLDER = $(abs_srcdir)/data/mobile/
MOBILE_DATA_WORKDIR = $(abs_builddir)/workdir/data/mobile/
MOBILE_TRACK_FOLDER=$(abs_builddir)/workdir/track/mobile

MULTIUSER_TEST_FOLDER = $(abs_srcdir)/integration_tests/multiuser
MULTIUSER_DATA_FOLDER = $(abs_srcdir)/data/multiuser/
MULTIUSER_DATA_WORKDIR = $(abs_builddir)/workdir/data/multiuser/
MULTIUSER_TRACK_FOLDER=$(abs_builddir)/workdir/track/multiuser

USER_INTERFACE = classic
UPDATE_SCREENSHOT = false

PHP_PROXY_PORT = 9983
NEXTCLOUD_PORT = 9980
ALLOWED_PORTS = $(if $(findstring php-proxy, $(CYPRESS_INTEGRATION)),$(PHP_PROXY_PORT),\
			$(if $(findstring nextcloud, $(CYPRESS_INTEGRATION)),$(NEXTCLOUD_PORT),$(shell seq 9900 1 9980)))

KILL_COMMAND=pkill -F $(PID_FILE) || pkill --signal SIGKILL -F $(PID_FILE)
PARALLEL_BUILD = $(findstring -j,$(MAKEFLAGS))
DISPLAY_NUMBER = 100
HEADLESS_BUILD := $(findstring Command failed,$(shell xhost > /dev/null 2>&1 || echo "Command failed, so we are in a headless environment."))
export HEADLESS_DISPLAY=$(shell who | grep `whoami` | grep -v ": " | xargs | cut -d " " -f2)
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

DESKTOP_TEST_FILES=$(subst $(DESKTOP_TEST_FOLDER)/,,$(wildcard $(DESKTOP_TEST_FOLDER)/*_spec.js) $(wildcard $(DESKTOP_TEST_FOLDER)/*/*_spec.js))

MULTIUSER_TEST_FILES=$(subst $(MULTIUSER_TEST_FOLDER)/,,$(wildcard $(MULTIUSER_TEST_FOLDER)/*_spec.js) $(wildcard $(MULTIUSER_TEST_FOLDER)/*/*_spec.js))

MOBILE_TEST_FILES_DONE= \
	$(foreach test_file,$(MOBILE_TEST_FILES),$(MOBILE_TRACK_FOLDER)/$(test_file).done)

DESKTOP_TEST_FILES_DONE= \
	$(foreach test_file,$(DESKTOP_TEST_FILES),$(DESKTOP_TRACK_FOLDER)/$(test_file).done)

DESKTOP_NB_TEST_FILES_DONE= \
	$(foreach test_file,$(DESKTOP_TEST_FILES),$(DESKTOP_NB_TRACK_FOLDER)/$(test_file).done)

MULTIUSER_TESTS_DONE= \
	$(MULTIUSER_TRACK_FOLDER)/multiuser_tests.done

check-local: do-check
	$(if $(wildcard $(ERROR_LOG)),$(error CypressError: some tests failed!))

do-check: $(DESKTOP_TEST_FILES_DONE) $(MOBILE_TEST_FILES_DONE) $(MULTIUSER_TESTS_DONE)
	@$(KILL_COMMAND) || true
	$(if $(HEADLESS_BUILD),@pkill Xvfb,)
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

check-notebookbar: $(DESKTOP_NB_TEST_FILES_DONE)
	@$(KILL_COMMAND) || true
	$(if $(HEADLESS_BUILD),@pkill Xvfb,)
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

$(PID_FILE): @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(if $(HEADLESS_BUILD),$(call start_Xvfb),)
	$(call start_coolwsd)

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

$(DESKTOP_NB_TEST_FILES_DONE): export USER_INTERFACE = notebookbar
$(DESKTOP_NB_TEST_FILES_DONE): $(PID_FILE)
	$(if $(PARALLEL_BUILD),\
		$(call run_desktop_tests,$(subst $(DESKTOP_NB_TRACK_FOLDER)/,,$(basename $@)),$(basename $@).log),\
		$(call run_desktop_tests))
	$(if $(PARALLEL_BUILD),\
		@mkdir -p $(dir $@) && touch $@\
		,\
		@$(foreach done_file,$(DESKTOP_NB_TEST_FILES_DONE),mkdir -p $(dir $(done_file)) && touch $(done_file) &&) true\
	)

$(MULTIUSER_TESTS_DONE): $(PID_FILE) $(MOBILE_TEST_FILES_DONE)
	$(call run_all_multiuser_tests)
	@mkdir -p $(dir $@) && touch $@

@JAILS_PATH@:
	mkdir -p $@

define run_JS_error_check
	@echo "Checking for JS errors in test code..."
	@echo
	@$(NODE) $(ESLINT_BINARY) $(abs_srcdir) \
		--ignore-path $(abs_srcdir)/.eslintignore --config $(abs_srcdir)/.eslintrc
	@echo
endef

define start_coolwsd
	$(eval FREE_PORT:=$(shell $(GET_PORT_BINARY) --host=127.0.0.1 $(ALLOWED_PORTS)))
	$(if $(findstring php-proxy, $(CYPRESS_INTEGRATION)),\
		$(if $(findstring $(PHP_PROXY_PORT),$(FREE_PORT)),,$(error CypressError: $(PHP_PROXY_PORT) port is unavailable!)))
	$(if $(findstring nextcloud, $(CYPRESS_INTEGRATION)),\
		$(if $(findstring $(NEXTCLOUD_PORT),$(FREE_PORT)),,$(error CypressError: $(NEXTCLOUD_PORT) port is unavailable!)))
	@echo "Found available port for testing: $(FREE_PORT)"
	@echo
	@echo "Launching coolwsd..."
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@echo
	@mkdir -p $(dir $(COOLWSD_OUTPUT))
	../coolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			--o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			--o:security.capabilities="$(CAPABILITIES)" \
			--disable-ssl --forcecaching \
			--o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			--o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			--o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			--o:admin_console.username=admin --o:admin_console.password=admin \
			--o:logging.file[@enable]=true --o:logging.level=trace \
			--o:welcome.enable=false \
			--o:user_interface.mode=$(USER_INTERFACE) \
			--o:security.enable_macros_execution=true \
			--port=$(FREE_PORT) \
			--pidfile=$(PID_FILE) \
			--o:logging.file.property[0]=$(COOLWSD_LOG) \
			--unattended \
			$(if $(findstring php-proxy, $(CYPRESS_INTEGRATION)),--o:net.proxy_prefix=true) \
			 > $(COOLWSD_OUTPUT) 2>&1 &
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

define cleanup_before_run
	@rm -f $(ERROR_LOG)
	@rm -f $(PID_FILE)
	@rm -rf cypress
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

clean-local:
	rm -rf node_modules
	rm -rf workdir
	rm -rf cypress
	rm -rf package-lock.json
	rm -rf .nyc_output
	rm -rf coverage

###############
# Mobile tests.
###############

check-mobile: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(if $(HEADLESS_BUILD),$(call start_Xvfb),)
	$(call start_coolwsd)
	$(call run_mobile_tests,$(spec))
	$(if $(HEADLESS_BUILD),@pkill Xvfb,)
	@$(KILL_COMMAND) || true

run-mobile: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(call start_coolwsd)
	$(call run_interactive_mobile,$(spec)) || true
	@$(KILL_COMMAND) || true

MOBILE_CONFIG = \
	specPattern=$(MOBILE_TEST_FOLDER)/**/*_spec.js,supportFile=$(SUPPORT_FILE),userAgent=$(MOBILE_USER_AGENT)

MOBILE_ENV = \
	CYPRESS_INCLUDE_TAGS=tagmobile,DATA_FOLDER=$(MOBILE_DATA_FOLDER),DATA_WORKDIR=$(MOBILE_DATA_WORKDIR),WSD_VERSION_HASH=$(COOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

# Run one mobile test / all mobile tests in interactive test runner.
# Parameters:
# 1 - spec (optional):	test file to run, if not specified all mobile tests are run.
define run_interactive_mobile
	@echo "Open cypress with mobile tests..."
	@echo
	$(if $(1),\
		$(eval SPEC_FILE=$(MOBILE_TEST_FOLDER)/$(1))\
		$(call check_spec_existence,$(1),mobile)\
		$(call run_interactive_single,$(MOBILE_CONFIG),$(MOBILE_ENV),$(SPEC_FILE))\
	,\
		$(call run_interactive_all,$(MOBILE_CONFIG),$(MOBILE_ENV))\
	)
endef

# Run one mobile test / all mobile tests in headless mode.
# Parameters:
# 1 - spec (optional):	test file to run, if not specified all mobile tests are run.
# 2 - log (optional):	log file for cypress run, needed for parallel build only.
# 3 - +env (optional):	additional env variables (will be appended to $(MOBILE_ENV).
define run_mobile_tests
	@echo $(if $(1),"Running cypress mobile test: $(1)","Running cypress mobile tests...")
	@echo
	$(eval ENV_EXTENDED=$(MOBILE_ENV)$(if $(3),$(COMMA)$(3)))
	$(if $(and $(PARALLEL_BUILD), $(1)),\
		@$(call run_test_parallel,\
			$(MOBILE_CONFIG),$(ENV_EXTENDED),$(1),mobile,$(2))\
	,\
		$(eval SPEC_FILE=$(if $(1),$(MOBILE_TEST_FOLDER)/$(1)))\
		$(if $(1),$(call check_spec_existence,$(1),mobile))\
		$(call run_test_headless,\
			$(MOBILE_CONFIG),$(ENV_EXTENDED),$(SPEC_FILE))\
	)
endef

################
# Desktop tests.
################

check-desktop: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(if $(HEADLESS_BUILD),$(call start_Xvfb),)
	$(call start_coolwsd)
	$(call run_desktop_tests,$(spec))
	$(if $(HEADLESS_BUILD),@pkill Xvfb,)
	@$(KILL_COMMAND) || true

run-desktop: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(call start_coolwsd)
	$(call run_interactive_desktop,$(spec)) || true
	@$(KILL_COMMAND) || true

DESKTOP_CONFIG = \
	specPattern=$(DESKTOP_TEST_FOLDER)/**/*_spec.js,supportFile=$(SUPPORT_FILE),userAgent=$(DESKTOP_USER_AGENT)

DESKTOP_ENV = \
	CYPRESS_INCLUDE_TAGS=tagdesktop,DATA_FOLDER=$(DESKTOP_DATA_FOLDER),DATA_WORKDIR=$(DESKTOP_DATA_WORKDIR),WSD_VERSION_HASH=$(COOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION),SCREENSHOT_FOLDER=$(abs_srcdir)/cypress/screenshots,IMAGES_FOLDER=$(abs_top_srcdir)/browser/images/help/en/

# Run one desktop test / all desktop tests in interactive test runner.
# Parameters:
# 1 - spec (optional):	test file to run, if not specified all desktop tests are run.
define run_interactive_desktop
	@echo "Open cypress with desktop tests..."
	@echo
	$(if $(1),\
		$(eval SPEC_FILE=$(DESKTOP_TEST_FOLDER)/$(1))\
		$(call check_spec_existence,$(1),desktop)\
		$(call run_interactive_single,$(DESKTOP_CONFIG),$(DESKTOP_ENV),$(SPEC_FILE))\
	,\
		$(call run_interactive_all,$(DESKTOP_CONFIG),$(DESKTOP_ENV))\
	)
endef

# Run one desktop test / all desktop tests in headless mode.
# Parameters:
# 1 - spec (optional):	test file to run, if not specified all desktop tests are run.
# 2 - log (optional):	log file for cypress run, needed for parallel build only.
# 3 - +env (optional):	additional env variables (will be appended to $(DESKTOP_ENV).
define run_desktop_tests
	@echo $(if $(1),"Running cypress desktop $(USER_INTERFACE) mode test: $(1)","Running cypress desktop $(USER_INTERFACE) mode tests...")
	@echo
	$(eval ENV_EXTENDED=$(DESKTOP_ENV)$(if $(3),$(COMMA)$(3)))
	$(if $(and $(PARALLEL_BUILD), $(1)),\
		@$(call run_test_parallel,\
			$(DESKTOP_CONFIG),$(ENV_EXTENDED),$(1),desktop,$(2))\
	,\
		$(eval SPEC_FILE=$(if $(1),$(DESKTOP_TEST_FOLDER)/$(1)))\
		$(if $(1),$(call check_spec_existence,$(1),desktop))\
		$(call run_test_headless,\
			$(DESKTOP_CONFIG),$(ENV_EXTENDED),$(SPEC_FILE))\
	)
endef

###################
# Multi-user tests.
###################
check-multi: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(if $(HEADLESS_BUILD),$(call start_Xvfb),)
	$(call start_coolwsd)
	$(if $(spec), \
		$(call run_multiuser_test,$(spec)), \
		$(call run_all_multiuser_tests))
	$(if $(HEADLESS_BUILD),@pkill Xvfb,)
	@$(KILL_COMMAND) || true

run-multi: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(call start_coolwsd)
	$(call run_interactive_multiuser,$(spec)) || true
	@$(KILL_COMMAND) || true

MULTIUSER_CONFIG = \
	specPattern=$(MULTIUSER_TEST_FOLDER)/**/*_spec.js,supportFile=$(SUPPORT_FILE),userAgent=$(DESKTOP_USER_AGENT)

MULTIUSER_ENV = \
	CYPRESS_INCLUDE_TAGS=tagmultiuser,DATA_FOLDER=$(MULTIUSER_DATA_FOLDER),DATA_WORKDIR=$(MULTIUSER_DATA_WORKDIR),WSD_VERSION_HASH=$(COOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

# Run all multi-user tests in headless mode.
# Parameters:
# 1 - +env (optional):	additional env variables (will be appended to $(MULTIUSER_ENV).
define run_all_multiuser_tests
	$(foreach test,$(MULTIUSER_TEST_FILES),$(call run_multiuser_test,$(test),$(1)))
endef

# Run one multiuser test / all multiuser tests in interactive test runner.
# Parameters:
# 1 - spec (optional):	test file to run, if not specified all desktop tests are run.
define run_interactive_multiuser
	@echo "Open cypress with multiuser tests..."
	@echo
	$(if $(1),\
		$(eval SPEC_FILE=$(MULTIUSER_TEST_FOLDER)/$(1))\
		$(call check_spec_existence,$(1),multi)\
		$(call run_interactive_single,$(MULTIUSER_CONFIG),$(MULTIUSER_ENV),$(SPEC_FILE))\
	,\
		$(call run_interactive_all,$(MULTIUSER_CONFIG),$(MULTIUSER_ENV))\
	)
endef

# Run one multi-user test in headless mode.
# Parameters:
# 1 - test name:	test name to run. This test name means to test files (user1, user2).
# 2 - +env (optional):	additional env variables (will be appended to $(MULTIUSER_ENV).
define run_multiuser_test
	$(call check_spec_existence,$(1),multi)
	@echo "Running cypress multi-user test: $(1)"
	@echo
	$(eval ENV_EXTENDED=$(MULTIUSER_ENV)$(if $(2),$(COMMA)$(2)))
	$(eval SPEC_FILE=$(if $(1),$(MULTIUSER_TEST_FOLDER)/$(1)))
	$(call run_test_headless,\
		$(MULTIUSER_CONFIG),$(ENV_EXTENDED),$(SPEC_FILE))
endef

############################
# Mobile interference tests.
############################

check-interfer-mobile: do-interfer-mobile-check-log
	$(if $(wildcard $(ERROR_LOG)),$(error CypressError: some tests failed!))

do-interfer-mobile-check-log: do-interfer-mobile-check
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

do-interfer-mobile-check: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(call start_coolwsd)
	$(if $(spec), \
		$(call run_mobile_interference_test,$(spec)), \
		$(call run_mobile_interference_tests))
	@$(KILL_COMMAND) || true

run-interfer-mobile: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(call start_coolwsd)
	@echo
	@echo "Running interfer mobile test in interactive test runner..."
	@echo
	$(call check_spec_existence,$(spec),mobile)
	$(eval USER1_SPEC=$(MOBILE_TEST_FOLDER)/$(spec))
	$(eval USER2_SPEC=interference_user_spec.js)
	$(eval USER2_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER2_SPEC).log)
	$(call run_interactive_single,\
		$(INTERFER_MOBILE_CONFIG1),$(INTERFER_MOBILE_ENV1),$(USER1_SPEC)) &
	@sleep 5
	@$(call run_test_parallel,\
		$(INTERFER_MOBILE_CONFIG2),$(INTERFER_MOBILE_ENV2),$(USER2_SPEC),interfer,$(USER2_LOG)) || true
	@$(KILL_COMMAND) || true

INTERFER_MOBILE_CONFIG1 = \
	specPattern=$(MOBILE_TEST_FOLDER)/**/*_spec.js,supportFile=$(SUPPORT_FILE),userAgent=$(MOBILE_USER_AGENT),defaultCommandTimeout=30000

INTERFER_MOBILE_ENV1 = \
	CYPRESS_INCLUDE_TAGS=tagmobile,DATA_FOLDER=$(MOBILE_DATA_FOLDER),DATA_WORKDIR=$(MULTIUSER_DATA_WORKDIR),WSD_VERSION_HASH=$(COOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION),INTERFERENCE_TEST=true

INTERFER_MOBILE_CONFIG2 = \
	supportFile=$(SUPPORT_FILE),userAgent=$(MOBILE_USER_AGENT),defaultCommandTimeout=30000,retries=0

INTERFER_MOBILE_ENV2 = \
	CYPRESS_INCLUDE_TAGS=tagmobile,DATA_FOLDER=$(MOBILE_DATA_FOLDER),DATA_WORKDIR=$(MULTIUSER_DATA_WORKDIR),WSD_VERSION_HASH=$(COOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

# Run all mobile interference tests in headless mode.
define run_mobile_interference_tests
	$(foreach test,$(MOBILE_TEST_FILES),$(call run_mobile_interference_test,$(test)))
endef

# Run one mobile interference test in headless mode.
# Parameters:
# 1 - mobile test file:	  test file to run parallel with the interference user spec file.
define run_mobile_interference_test
	@echo "Running cypress mobile interference test: $(1)"
	@echo
	$(call check_spec_existence,$(1),mobile)
	$(eval USER1_SPEC=$(1))
	$(eval USER2_SPEC=interference_user_spec.js)
	$(eval USER1_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER1_SPEC).log)
	$(eval USER2_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER2_SPEC).log)
	@$(call run_test_parallel,\
		$(INTERFER_MOBILE_CONFIG1),$(INTERFER_MOBILE_ENV1),$(USER1_SPEC),interfer-mobile,$(USER1_LOG)) & \
	sleep 5 && \
	$(call run_test_parallel,\
		$(INTERFER_MOBILE_CONFIG2),$(INTERFER_MOBILE_ENV2),$(USER2_SPEC),interfer,$(USER2_LOG)) && \
	wait # waits the background process to be finished
endef

#############################
# Desktop interference tests.
#############################

check-interfer-desktop: do-interfer-desktop-check-log
	$(if $(wildcard $(ERROR_LOG)),$(error CypressError: some tests failed!))

do-interfer-desktop-check-log: do-interfer-desktop-check
	$(if $(wildcard $(ERROR_LOG)),@cat $(ERROR_LOG))

do-interfer-desktop-check: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(call start_coolwsd)
	$(if $(spec), \
		$(call run_desktop_interference_test,$(spec)), \
		$(call run_desktop_interference_tests))
	@$(KILL_COMMAND) || true

run-interfer-desktop: @JAILS_PATH@ $(NODE_BINS)
	$(call cleanup_before_run)
	$(call run_JS_error_check)
	$(call start_coolwsd)
	@echo
	@echo "Running interfer desktop test in interactive test runner..."
	@echo
	$(call check_spec_existence,$(spec),desktop)
	$(eval USER1_SPEC=$(DESKTOP_TEST_FOLDER)/$(spec))
	$(eval USER2_SPEC=interference_user_spec.js)
	$(eval USER2_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER2_SPEC).log)
	$(call run_interactive_single,\
		$(INTERFER_DESKTOP_CONFIG1),$(INTERFER_DESKTOP_ENV1),$(USER1_SPEC)) &
	@sleep 5
	@$(call run_test_parallel,\
		$(INTERFER_DESKTOP_CONFIG2),$(INTERFER_DESKTOP_ENV2),$(USER2_SPEC),interfer,$(USER2_LOG)) || true
	@$(KILL_COMMAND) || true

INTERFER_DESKTOP_CONFIG1 = \
	specPattern=$(DESKTOP_TEST_FOLDER)/**/*_spec.js,supportFile=$(SUPPORT_FILE),userAgent=$(DESKTOP_USER_AGENT),defaultCommandTimeout=30000

INTERFER_DESKTOP_ENV1 = \
	DATA_FOLDER=$(DESKTOP_DATA_FOLDER),DATA_WORKDIR=$(MULTIUSER_DATA_WORKDIR),WSD_VERSION_HASH=$(COOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION),INTERFERENCE_TEST=true

INTERFER_DESKTOP_CONFIG2 = \
	supportFile=$(SUPPORT_FILE),userAgent=$(DESKTOP_USER_AGENT),defaultCommandTimeout=30000,retries=0

INTERFER_DESKTOP_ENV2 = \
	DATA_FOLDER=$(DESKTOP_DATA_FOLDER),DATA_WORKDIR=$(MULTIUSER_DATA_WORKDIR),WSD_VERSION_HASH=$(COOLWSD_VERSION_HASH),SERVER_PORT=$(FREE_PORT),LO_CORE_VERSION="$(CORE_VERSION)",INTEGRATION=$(CYPRESS_INTEGRATION)

# Run all desktop interference test in headless mode.
define run_desktop_interference_tests
	$(foreach test,$(DESKTOP_TEST_FILES),$(call run_desktop_interference_test,$(test)))
endef

# Run one desktop interference test in headless mode.
# Parameters:
# 1 - desktop test file:    test file to run parallel with the interference user spec file.
define run_desktop_interference_test
	@echo "Running cypress desktop interference test: $(1)"
	@echo
	$(call check_spec_existence,$(1),desktop)
	$(eval USER1_SPEC=$(1))
	$(eval USER2_SPEC=interference_user_spec.js)
	$(eval USER1_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER1_SPEC).log)
	$(eval USER2_LOG=$(MULTIUSER_TRACK_FOLDER)/$(USER2_SPEC).log)
	@$(call run_test_parallel,\
		$(INTERFER_DESKTOP_CONFIG1),$(INTERFER_DESKTOP_ENV1),$(USER1_SPEC),interfer-desktop,$(USER1_LOG)) & \
	sleep 5 && \
	$(call run_test_parallel,\
		$(INTERFER_DESKTOP_CONFIG2),$(INTERFER_DESKTOP_ENV2),$(USER2_SPEC),interfer,$(USER2_LOG)) && \
	wait # waits the background process to be finished
endef

################
# Test coverage.
################

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
	cd .. && npx nyc instrument --compact=false browser/src browser/dist/src && cd cypress_test
	@echo
	@echo "Run all tests..."
	@echo
	$(call cleanup_before_run)
	$(call start_coolwsd)
	$(call run_desktop_tests,,,COVERAGE_RUN="1")
	$(call run_mobile_tests,,,COVERAGE_RUN="1")
	$(call run_all_multiuser_tests,COVERAGE_RUN="1")
	@$(KILL_COMMAND) || true

####################
# General functions.
####################

# Open cypress interactive test runner window with all tests in it.
#
# Parameters:
# 1 - config: cypress configuration (e.g. cypress' --config argument).
# 2 - env:    list of environment variables (e.g. cypress' --env argument).
define run_interactive_all
	DEBUG='cypress:*' \
	DISPLAY=$(if $(HEADLESS_BUILD),$(HEADLESS_DISPLAY),$(DISPLAY)) \
		$(CYPRESS_BINARY) open \
		--config $(1) \
		--env $(2)
endef

# Run single test in cypress interactive test runner.
#
# Parameters:
# 1 - config: cypress configuration (e.g. cypress' --config argument).
# 2 - env:    list of environment variables (e.g. cypress' --env argument).
# 3 - spec:   test file path (e.g. cypress' --spec argument)
define run_interactive_single
	DEBUG='cypress:*' \
	DISPLAY=$(if $(HEADLESS_BUILD),$(HEADLESS_DISPLAY),$(DISPLAY)) \
		$(CYPRESS_BINARY) run \
		--browser $(BROWSER) \
		--headed --no-exit \
		--config $(1),retries=0 \
		--env $(2) \
		--spec=$(3)
endef

# Run one test in parallel mode, using parallel running script.
#
# Parameters:
# 1 - config: cypress configuration (e.g. cypress' --config argument).
# 2 - env:    list of environment variables (e.g. cypress' --env argument).
# 3 - spec:   test file path (e.g. cypress' --spec argument)
# 4 - type:   test type (e.g. mobile, desktop, multi-user)
# 5 - log:    log file path
define run_test_parallel
	$(PARALLEL_SCRIPT) \
		--browser $(BROWSER) \
		--config $(1) \
		--env $(2) \
		--spec $(3) \
		--type $(4) \
		--log-file $(5)
endef

# Run one test \ tests in headless mode.
#
# Parameters:
# 1 - config:		 cypress configuration (e.g. cypress' --config argument).
# 2 - env:		 list of environment variables (e.g. cypress' --env argument).
# 3 - spec (optional):   test file path (e.g. cypress' --spec argument)
define run_test_headless
	$(CYPRESS_BINARY) run \
		--browser $(BROWSER) \
		--headless \
		--config $(1) \
		--env $(2) \
		$(if $(3),--spec=$(3)) \
		|| ($(KILL_COMMAND) && false)
endef

# Checks whether the given spec file exists.
# We run this check when the spec file was specified by
# the user so we can give clearer error message.
#
# Parameters:
# 1 - spec:	      test file path (e.g. make check-mobile spec=...)
# 2 - test type:      mobile, desktop or multi test.
define check_spec_existence
	$(eval TEST_FILES=$(if $(filter mobile,$(2)),$(MOBILE_TEST_FILES),\
				$(if $(filter desktop,$(2)),$(DESKTOP_TEST_FILES),\
				$(if $(filter multi,$(2)),$(MULTIUSER_TEST_FILES)))))
	$(if $(filter $(1),$(TEST_FILES)),,$(error CypressError: Can't find the given spec file!))

endef

else

check-local:
	$(error CypressError: Can't find LibreOffice core installation!)

endif
endif
