from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('''CREATE TABLE `hr_app_employeepayhead` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `effective_date` date NULL, `rate` numeric(12, 2) NOT NULL, `created_at` datetime(6) NOT NULL, `updated_at` datetime(6) NOT NULL, `payhead_id` bigint NOT NULL, `unit_id` bigint NULL, `user_id` bigint NOT NULL);''')
    cursor.execute('''ALTER TABLE `hr_app_employeepayhead` ADD CONSTRAINT `hr_app_employeepayhead_user_id_payhead_id_effec_2c78515a_uniq` UNIQUE (`user_id`, `payhead_id`, `effective_date`);''')
    cursor.execute('''ALTER TABLE `hr_app_employeepayhead` ADD CONSTRAINT `hr_app_employeepayhead_payhead_id_4cc3f881_fk_hr_app_payhead_id` FOREIGN KEY (`payhead_id`) REFERENCES `hr_app_payhead` (`id`);''')
    cursor.execute('''ALTER TABLE `hr_app_employeepayhead` ADD CONSTRAINT `hr_app_employeepayhead_unit_id_411b8227_fk_inventory_app_unit_id` FOREIGN KEY (`unit_id`) REFERENCES `inventory_app_unit` (`id`);''')
    cursor.execute('''ALTER TABLE `hr_app_employeepayhead` ADD CONSTRAINT `hr_app_employeepayhe_user_id_6dc2b71b_fk_rarenett_` FOREIGN KEY (`user_id`) REFERENCES `rarenett_app_candidate` (`id`);''')
