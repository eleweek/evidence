# Data for Customer => {$page.params.customer_id}

```rentals_by_customer
select customer_id as customer_id,
count(*) as rentals
from rental
group by 1
order by 2 DESC
```

```rentals_by_day_customer
select
customer_id as customer_id,
date_trunc('day', rental_date) as day,
count(*) as rentals 
from rental
group by 1, 2 
order by 3 DESC
```


<Value 
    data={data.rentals_by_customer.filter(r => r.customer_id === $page.params.customer_id)} 
    column=rentals
/>
<LineChart data={data.rentals_by_day_customer.filter(d => d.customer_id === $page.params.customer_id)} x=day y=rentals/>
<LineChart data={data.rentals_by_day_customer.filter(d => d.customer_id === 148)} x=day y=rentals/>