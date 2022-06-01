# Rentals Summary

This analyses the rentals

## Rentals by customer

```all_actors
SELECT * FROM expiring_dataset.actor LIMIT 1000;
```

```rentals_by_customer
select concat(a.first_name, ' ', a.last_name) as actor_name, f.title, f.release_year, f.rating, f.last_update from expiring_dataset.film f inner join expiring_dataset.film_actor fa ON fa.film_id = f.film_id inner join expiring_dataset.actor a on fa.actor_id = a.actor_id order by f.last_update desc limit 5;
```

Meta Data
<Value value={JSON.stringify(data.evidencemeta, 2, null)}/>

<br/>
/>
