from django import forms
from .models import Vehicle_category


class VehicleCategoryForm(forms.ModelForm):
    category_name = forms.CharField(
        max_length=50,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'e.g. Heavy Truck, Sedan, Van…',
            'autofocus': True,
        }),
        label='Category Name',
        error_messages={
            'required': 'Category name is required.',
            'max_length': 'Category name must be 50 characters or fewer.',
        }
    )

    class Meta:
        model = Vehicle_category
        fields = ['category_name']

    def clean_category_name(self):
        name = self.cleaned_data.get('category_name', '').strip()
        if not name:
            raise forms.ValidationError('Category name cannot be blank.')
        qs = Vehicle_category.objects.filter(category_name__iexact=name)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError(
                f'A vehicle category named "{name}" already exists.'
            )
        return name