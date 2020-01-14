CYPRESS_BINARY = ${abs_srcdir}/node_modules/cypress/bin/cypress

DESKTOP_TEST_FOLDER = integration_tests/desktop
MOBILE_TEST_FOLDER = integration_tests/mobile
MOBILE_USER_AGENT = "cypress mobile test"

if HAVE_LO_PATH
check-local: @JAILS_PATH@
	@npm install
	@echo "Checking for loleaflet JS errors..."
	@NODE_PATH=$(abs_srcdir)/node_modules $(NODE) node_modules/eslint/bin/eslint.js $(abs_srcdir) \
			--ignore-path $(abs_srcdir)/.eslintignore --config $(abs_top_srcdir)/loleaflet/.eslintrc

	@echo
	@pkill loolwsd || true
	@echo "Launching loolwsd for testing.."
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@echo
	../loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			--o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			--o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			--o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			--o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			--o:admin_console.username=admin --o:admin_console.password=admin \
			--o:logging.file[@enable]=true --o:logging.level=trace > /dev/null 2>&1 &
	@sleep 10
	@echo
	@echo "Running cypress desktop tests..."
	@echo
	$(CYPRESS_BINARY) run --browser chrome \
			--config integrationFolder=$(DESKTOP_TEST_FOLDER) \
			--headless \
			--env DATA_FOLDER=$(abs_srcdir)/data/desktop/,WORKDIR=$(abs_srcdir)/workdir/desktop/ || \
			(pkill loolwsd && false)
	@echo
	@echo "Running cypress mobile tests..."
	@echo
	$(CYPRESS_BINARY) run --browser chrome \
			--config integrationFolder=$(MOBILE_TEST_FOLDER),userAgent=$(MOBILE_USER_AGENT) \
			--headless \
			--env DATA_FOLDER=$(abs_srcdir)/data/mobile/,WORKDIR=$(abs_srcdir)/workdir/mobile/ || \
			(pkill loolwsd && false)
	@pkill loolwsd || true
endif

clean-local:
	rm -rf node_modules
	rm -rf workdir
	rm -rf cypress
	rm -rf package-lock.json
