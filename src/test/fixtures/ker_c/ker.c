#include <linux/init.h>
#include <linux/module.h>
#include <linux/uaccess.h>
#include <linux/fs.h>
#include <linux/proc_fs.h>
Module metadata
MODULE_AUTHOR("Ruan de Bruyn");
MODULE_DESCRIPTION("Hello world driver");
MODULE_LICENSE("GPL");
Custom init and exit methods
int custom_init() {
 printk("Hello world driver loaded.");
 return 0;
}
void custom_exit() {
 printk("Goodbye my friend, I shall miss you dearly...");
}
// module_init(custom_init);
// module_exit(custom_exit);