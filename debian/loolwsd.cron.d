0 0 */1 * * root find /var/cache/loolwsd -name "*.png" -a -atime +10 -exec rm {} \;
